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
    external = 8080
    internal = 80
  }

  volumes {
    host_path      = "/home/ignasipc22/Descargas/XarxesAvançades/Previa3/html"
    container_path = "/usr/share/nginx/html"
  }
}