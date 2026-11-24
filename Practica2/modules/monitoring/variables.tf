variable "environment" {
  description = "Nombre del entorno (dev o prod). Se añade como etiqueta a los logs."
  type        = string
}

variable "prefix" {
  description = "Prefijo de los recursos del entorno (por ejemplo aquarium-prod). Debe coincidir con el de los contenedores a monitorizar."
  type        = string
}

variable "grafana_port" {
  description = "Puerto del host (solo 127.0.0.1) donde se publica Grafana."
  type        = number
}

variable "grafana_admin_password" {
  description = "Contraseña del usuario admin de Grafana."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(var.grafana_admin_password) >= 8
    error_message = "La contraseña de admin de Grafana debe tener al menos 8 caracteres."
  }
}
