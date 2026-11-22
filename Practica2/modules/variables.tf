# Entradas del módulo: es lo único que cambia entre DEV y PROD.

variable "environment" {
  description = "Nombre del entorno: \"dev\" o \"prod\". Prefija los recursos y se pasa a la app como APP_ENV."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "El entorno debe ser \"dev\" o \"prod\" (el frontend usa este valor para decidir si muestra Redis)."
  }
}

variable "enable_cache" {
  description = "Si es true despliega Redis y activa la caché en la app (PROD). Si es false, la app funciona sin Redis (DEV)."
  type        = bool
  default     = false
}

variable "web_port" {
  description = "Puerto del host donde se publica la web (el contenedor escucha en el 5000)."
  type        = number
}

variable "mysql_database" {
  description = "Nombre de la base de datos que crea MySQL."
  type        = string
}

variable "mysql_user" {
  description = "Usuario de MySQL que utiliza la aplicación."
  type        = string
}

variable "mysql_password" {
  description = "Contraseña del usuario de la aplicación."
  type        = string
  sensitive   = true
}

variable "mysql_root_password" {
  description = "Contraseña del usuario root de MySQL (la usa también el healthcheck)."
  type        = string
  sensitive   = true
}

variable "web_replicas" {
  description = "Número de instancias de la web detrás del balanceador."
  type        = number
  default     = 2

  validation {
    condition     = var.web_replicas >= 1
    error_message = "Debe haber al menos una instancia."
  }
}

variable "lb_policy" {
  description = "Política de reparto: roundrobin, leastconn o source."
  type        = string
  default     = "roundrobin"

  validation {
    condition     = contains(["roundrobin", "leastconn", "source"], var.lb_policy)
    error_message = "lb_policy debe ser roundrobin, leastconn o source."
  }
}