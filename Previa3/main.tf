terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

provider "docker" {}

# Pulls the image
resource "docker_image" "nginx" {
  name         = "nginx:latest"
  keep_locally = true
}

# Create a container
resource "docker_container" "nginx" {
  name   = "nginx"
  image  = docker_image.nginx.image_id

  ports {
    external = var.external_port
    internal = 80
  }

  volumes {
    host_path      = "/home/ignasipc22/Descargas/XarxesAvançades/Previa3/html"
    container_path = "/usr/share/nginx/html"
  }
}

resource "docker_service" "nginx_service" {
  name = "nginx_service"

  task_spec {
    container_spec {
      image = docker_image.nginx.repo_digest
    }
  }

  mode {
    replicated {
      replicas = 2
    }
  }

  endpoint_spec {
    ports {
      published_port = var.external_port
      target_port = 80
    }    
  }
}

# Configuración de la variable del puerto externo
variable "external_port" {
  description = "Puerto externo del contenedor Nginx"
  type        = number
  default     = 8080
}