# Módulo "aquarium": define UN entorno completo de la aplicación
# (red, volúmenes, imágenes y contenedores). Se reutiliza para DEV y PROD:
# lo único que cambia entre entornos son las variables que recibe.

locals {
  # Prefijo común: evita colisiones de nombres cuando DEV y PROD conviven en el mismo Docker
  # (equivale al "-p aquarium-dev / aquarium-prod" de docker compose).
  prefix = "aquarium-${var.environment}"

  # Rutas absolutas a app/ y db/ (Docker exige rutas absolutas en los bind mounts).
  # Se calculan desde la ubicación del módulo: Practica2/app y Practica2/db.
  app_dir = abspath("${path.module}/../app")
  db_dir  = abspath("${path.module}/../db")
}

# ---------------------------------------------------------------------------
# Red y volúmenes
# ---------------------------------------------------------------------------

# Red propia de cada entorno. Los contenedores se encuentran entre sí por nombre.
resource "docker_network" "internal" {
  name = "${local.prefix}-net"
}

# Persistencia de MySQL.
resource "docker_volume" "db_data" {
  name = "${local.prefix}-db-data"
}

# Persistencia de Redis (como en la Práctica 1). Solo existe si hay caché.
resource "docker_volume" "redis_data" {
  count = var.enable_cache ? 1 : 0
  name  = "${local.prefix}-redis-data"
}

# ---------------------------------------------------------------------------
# Imágenes
# ---------------------------------------------------------------------------

# Imagen de la aplicación, construida desde app/Dockerfile.
resource "docker_image" "web" {
  name = "${local.prefix}-web:latest"

  build {
    context = local.app_dir
  }

  # Terraform no detecta cambios dentro del contexto de build. Este hash de todos
  # los ficheros de app/ fuerza a reconstruir la imagen cuando se edita el código.
  triggers = {
    dir_sha1 = sha1(join("", [for f in fileset(local.app_dir, "**") : filesha1("${local.app_dir}/${f}")]))
  }
}

# Imágenes oficiales. keep_locally evita que un "destroy" las borre mientras
# el otro entorno todavía las está usando.
resource "docker_image" "mysql" {
  name         = "mysql:8.0"
  keep_locally = true
}

resource "docker_image" "redis" {
  count        = var.enable_cache ? 1 : 0
  name         = "redis:7-alpine"
  keep_locally = true
}

# ---------------------------------------------------------------------------
# Contenedores
# ---------------------------------------------------------------------------

resource "docker_container" "db" {
  name         = "${local.prefix}-db"
  image        = docker_image.mysql.image_id
  restart      = "unless-stopped"
  wait         = true # no se da por creado hasta que el healthcheck esté "healthy"
  wait_timeout = 180  # la primera vez MySQL ejecuta init.sql y carga las imágenes

  env = [
    "MYSQL_ROOT_PASSWORD=${var.mysql_root_password}",
    "MYSQL_DATABASE=${var.mysql_database}",
    "MYSQL_USER=${var.mysql_user}",
    "MYSQL_PASSWORD=${var.mysql_password}",
  ]

  # Datos persistentes en un volumen Docker.
  volumes {
    volume_name    = docker_volume.db_data.name
    container_path = "/var/lib/mysql"
  }

  # Script de inicialización: solo se ejecuta si el volumen está vacío.
  volumes {
    host_path      = "${local.db_dir}/init.sql"
    container_path = "/docker-entrypoint-initdb.d/01-init.sql"
    read_only      = true
  }

  # Imágenes que init.sql carga con LOAD_FILE (se monta igual que en la Práctica 1).
  volumes {
    host_path      = "${local.db_dir}/images"
    container_path = "/var/lib/mysql-files"
  }

  networks_advanced {
    name = docker_network.internal.name
  }

  healthcheck {
    test         = ["CMD-SHELL", "mysqladmin ping --protocol=tcp -h 127.0.0.1 -uroot -p\"$${MYSQL_ROOT_PASSWORD}\" --silent"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 12
    start_period = "30s"
  }
}

# Redis solo existe cuando enable_cache = true (PROD).
resource "docker_container" "cache" {
  count   = var.enable_cache ? 1 : 0
  name    = "${local.prefix}-cache"
  image   = docker_image.redis[0].image_id
  command = ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
  restart = "unless-stopped"
  wait    = true

  volumes {
    volume_name    = docker_volume.redis_data[0].name
    container_path = "/data"
  }

  networks_advanced {
    name = docker_network.internal.name
  }

  healthcheck {
    test         = ["CMD", "redis-cli", "ping"]
    interval     = "10s"
    timeout      = "3s"
    retries      = 5
    start_period = "5s"
  }
}

# Aplicación (Flask + gunicorn). También sirve el frontend (templates/ y static/).
resource "docker_container" "web" {
  count   = var.web_replicas
  name    = "${local.prefix}-web-${count.index + 1}"
  image   = docker_image.web.image_id
  restart = "unless-stopped"

  # Referenciar el nombre de los contenedores como host crea la dependencia:
  # web se crea después de que db (y cache) estén sanos. Docker resuelve esos
  # nombres dentro de la red del entorno.
  env = concat(
    [
      "APP_ENV=${var.environment}",
      "CACHE_ENABLED=${var.enable_cache}",
      "MYSQL_HOST=${docker_container.db.name}",
      "MYSQL_PORT=3306",
      "MYSQL_DATABASE=${var.mysql_database}",
      "MYSQL_USER=${var.mysql_user}",
      "MYSQL_PASSWORD=${var.mysql_password}",
    ],
    var.enable_cache ? [
      "REDIS_HOST=${docker_container.cache[0].name}",
      "REDIS_PORT=6379",
    ] : []
  )

  networks_advanced {
    name = docker_network.internal.name
  }

  healthcheck {
    test         = ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/status', timeout=3).read()"]
    interval     = "30s"
    timeout      = "5s"
    retries      = 3
    start_period = "10s"
  }
}
