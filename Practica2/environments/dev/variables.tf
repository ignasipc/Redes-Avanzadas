# Contraseñas de DEV. No tienen valor por defecto: se leen de secrets.auto.tfvars.

variable "mysql_password" {
  description = "Contraseña del usuario MySQL de la aplicación (DEV)."
  type        = string
  sensitive   = true
}

variable "mysql_root_password" {
  description = "Contraseña de root de MySQL (DEV)."
  type        = string
  sensitive   = true
}
