# Valores que el módulo devuelve a quien lo usa.

output "web_url" {
  description = "URL de la aplicación en el host."
  value       = "http://localhost:${var.web_port}"
}
