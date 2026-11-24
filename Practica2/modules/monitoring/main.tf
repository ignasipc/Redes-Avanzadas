# Submódulo "monitoring": stack de monitorización de UN entorno.
#
#   MÉTRICAS (red interna "metrics")   HAProxy + cAdvisor -> Prometheus -> Grafana
#   LOGS     (red interna "logs")      Docker -> Alloy -> Loki          -> Grafana
#
# Grafana es lo único conectado a las dos redes (y a una tercera, normal, para
# publicar su puerto en el host): métricas y logs no se mezclan hasta Grafana.

locals {
  # Versiones de las imágenes, fijadas en un único sitio.
  images = {
    prometheus = "prom/prometheus:v3.14.0"
    grafana    = "grafana/grafana:12.4.0"
    loki       = "grafana/loki:3.7.6"
    alloy      = "grafana/alloy:v1.20.0"
    cadvisor   = "ghcr.io/google/cadvisor:v0.60.3"
  }

  # El nombre del contenedor es también su nombre DNS dentro de las redes.
  # "lb" es el balanceador, que crea el módulo padre.
  names = { for s in ["lb", "prometheus", "loki", "grafana", "alloy", "cadvisor"] : s => "${var.prefix}-${s}" }
}

# ---------------------------------------------------------------------------
# Redes, volúmenes e imágenes
# ---------------------------------------------------------------------------

# Redes internas: sin salida a Internet.
resource "docker_network" "metrics" {
  name     = "${var.prefix}-metrics"
  internal = true
}

resource "docker_network" "logs" {
  name     = "${var.prefix}-logs"
  internal = true
}

# Red normal, solo para poder publicar el puerto de Grafana.
resource "docker_network" "access" {
  name = "${var.prefix}-grafana-access"
}

# Datos persistentes: histórico de métricas, logs y base de datos de Grafana.
resource "docker_volume" "data" {
  for_each = toset(["prometheus", "loki", "grafana"])
  name     = "${var.prefix}-${each.key}-data"
}

resource "docker_image" "this" {
  for_each     = local.images
  name         = each.value
  keep_locally = true
}

# ---------------------------------------------------------------------------
# Métricas: cAdvisor -> Prometheus
# ---------------------------------------------------------------------------

# Mide CPU, memoria y estado de cada contenedor y lo publica en /metrics.
resource "docker_container" "cadvisor" {
  name          = local.names.cadvisor
  image         = docker_image.this["cadvisor"].image_id
  restart       = "unless-stopped"
  memory        = 256
  security_opts = ["no-new-privileges:true"]
  command = ["--docker_only=true", "--housekeeping_interval=15s"]

  # Necesita ver el host para medir los contenedores (todo en solo lectura).
  volumes {
    host_path      = "/"
    container_path = "/rootfs"
    read_only      = true
  }
  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
    read_only      = true
  }
  volumes {
    host_path      = "/run/containerd/containerd.sock"
    container_path = "/run/containerd/containerd.sock"
    read_only      = true
  }
  volumes {
    host_path      = "/sys"
    container_path = "/sys"
    read_only      = true
  }
  volumes {
    host_path      = "/var/lib/docker"
    container_path = "/var/lib/docker"
    read_only      = true
  }

  networks_advanced {
    name = docker_network.metrics.name
  }
}

# Recoge (scrape) las métricas de HAProxy y cAdvisor cada 15 s y las almacena 7 días.
resource "docker_container" "prometheus" {
  name          = local.names.prometheus
  image         = docker_image.this["prometheus"].image_id
  restart       = "unless-stopped"
  memory        = 512
  security_opts = ["no-new-privileges:true"]

  command = [
    "--config.file=/etc/prometheus/prometheus.yml",
    "--storage.tsdb.path=/prometheus",
    "--storage.tsdb.retention.time=7d",
  ]

  upload {
    file = "/etc/prometheus/prometheus.yml"
    content = templatefile("${path.module}/config/prometheus.yml.tftpl", {
      lb       = local.names.lb
      cadvisor = local.names.cadvisor
    })
  }

  volumes {
    volume_name    = docker_volume.data["prometheus"].name
    container_path = "/prometheus"
  }

  networks_advanced {
    name = docker_network.metrics.name
  }
}

# ---------------------------------------------------------------------------
# Logs: Docker -> Alloy -> Loki
# ---------------------------------------------------------------------------

# Almacén de logs (retención de 7 días).
resource "docker_container" "loki" {
  name          = local.names.loki
  image         = docker_image.this["loki"].image_id
  restart       = "unless-stopped"
  memory        = 512
  security_opts = ["no-new-privileges:true"]
  command       = ["-config.file=/etc/loki/config.yaml"]

  upload {
    file    = "/etc/loki/config.yaml"
    content = file("${path.module}/config/loki.yaml")
  }

  volumes {
    volume_name    = docker_volume.data["loki"].name
    container_path = "/loki"
  }

  networks_advanced {
    name = docker_network.logs.name
  }
}

# Lee la salida estándar de los contenedores del entorno a través de Docker y la envía a Loki.
# Por eso la web no necesita estar en la red de logs.
resource "docker_container" "alloy" {
  name          = local.names.alloy
  image         = docker_image.this["alloy"].image_id
  restart       = "unless-stopped"
  memory        = 256
  security_opts = ["no-new-privileges:true"]
  user          = "root" # necesario para leer el socket de Docker

  command = [
    "run",
    "--server.http.listen-addr=127.0.0.1:12345",
    "--storage.path=/var/lib/alloy/data",
    "/etc/alloy/config.alloy",
  ]

  upload {
    file = "/etc/alloy/config.alloy"
    content = templatefile("${path.module}/config/config.alloy.tftpl", {
      prefix      = var.prefix
      environment = var.environment
      loki        = local.names.loki
    })
  }

  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
    read_only      = true
  }

  networks_advanced {
    name = docker_network.logs.name
  }
}

# ---------------------------------------------------------------------------
# Visualización: Grafana
# ---------------------------------------------------------------------------

# Lee de Prometheus (métricas) y de Loki (logs) y arranca ya configurado:
# orígenes de datos y un dashboard cargados desde archivos.
resource "docker_container" "grafana" {
  name          = local.names.grafana
  image         = docker_image.this["grafana"].image_id
  restart       = "unless-stopped"
  memory        = 512
  security_opts = ["no-new-privileges:true"]

  env = [
    "GF_SECURITY_ADMIN_USER=admin",
    "GF_SECURITY_ADMIN_PASSWORD=${var.grafana_admin_password}",
    "GF_USERS_ALLOW_SIGN_UP=false",
    "GF_AUTH_ANONYMOUS_ENABLED=false",
    "GF_ANALYTICS_REPORTING_ENABLED=false",
    "GF_ANALYTICS_CHECK_FOR_UPDATES=false",
    "GF_AUTH_LOGIN_COOKIE_NAME=grafana_session_${var.environment}",
  ]

  # Solo accesible desde la propia máquina.
  ports {
    internal = 3000
    external = var.grafana_port
    ip       = "127.0.0.1"
  }

  upload {
    file = "/etc/grafana/provisioning/datasources/datasources.yaml"
    content = templatefile("${path.module}/config/grafana-datasources.yaml.tftpl", {
      prometheus = local.names.prometheus
      loki       = local.names.loki
    })
  }

  upload {
    file    = "/etc/grafana/provisioning/dashboards/dashboards.yaml"
    content = file("${path.module}/config/grafana-dashboards.yaml")
  }

  upload {
    file = "/etc/grafana/provisioning/dashboards/aquarium.json"
    content = templatefile("${path.module}/config/dashboard.json.tftpl", {
      prefix      = var.prefix
      environment = var.environment
    })
  }

  volumes {
    volume_name    = docker_volume.data["grafana"].name
    container_path = "/var/lib/grafana"
  }

  networks_advanced {
    name = docker_network.metrics.name
  }
  networks_advanced {
    name = docker_network.logs.name
  }
  networks_advanced {
    name = docker_network.access.name
  }
}
