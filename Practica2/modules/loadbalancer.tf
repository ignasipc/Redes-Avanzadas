# Balanceador de carga (HAProxy): único punto de entrada de cada entorno.
# Reparte las peticiones entre las instancias de la web según var.lb_policy.

resource "docker_image" "haproxy" {
  name         = "haproxy:3.2-alpine"
  keep_locally = true
}

resource "docker_container" "lb" {
  name    = "${local.prefix}-lb"
  image   = docker_image.haproxy.image_id
  restart = "unless-stopped"

  # La configuración se genera desde la plantilla y se inyecta al crear el contenedor.
  # Si cambia el número de réplicas o la política, Terraform recrea el balanceador.
  upload {
    file = "/usr/local/etc/haproxy/haproxy.cfg"
    content = templatefile("${path.module}/haproxy.cfg.tftpl", {
      policy          = var.lb_policy
      backends        = docker_container.web[*].name
      metrics_enabled = var.enable_monitoring
    })
  }

  # Es lo único que publica puerto: la URL de cada entorno (8081 / 8080) no cambia.
  ports {
    internal = 8080
    external = var.web_port
  }

  networks_advanced {
    name = docker_network.internal.name
  }

  dynamic "networks_advanced" {
    for_each = module.monitoring[*].metrics_network
    content {
      name = networks_advanced.value
    }
  }
}