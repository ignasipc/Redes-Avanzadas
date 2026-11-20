# Contraseñas de PROD. No tienen valor por defecto: se leen de secrets.auto.tfvars.

variable "mysql_password" {
  description = "Contraseña del usuario MySQL de la aplicación (PROD)."
  type        = string
  sensitive   = true
}

variable "mysql_root_password" {
  description = "Contraseña de root de MySQL (PROD)."
  type        = string
  sensitive   = true
}
