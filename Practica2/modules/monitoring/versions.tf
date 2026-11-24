# Cada módulo que usa el provider de Docker debe declararlo.
terraform {
  required_version = ">= 1.1"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}
