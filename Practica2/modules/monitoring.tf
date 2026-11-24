# Monitorización opcional del entorno (Prometheus + Grafana + Loki + Alloy + cAdvisor).
# Todo el stack vive en el submódulo ./monitoring y se activa con enable_monitoring.

variable "enable_monitoring" {
  description = "Si es true, despliega el stack de monitorización. Si es false, no se crea nada."
  type        = bool
  default     = false
}

variable "grafana_port" {
  description = "Puerto del host (solo 127.0.0.1) donde se publica Grafana."
  type        = number
  default     = 3000
}

variable "grafana_admin_password" {
  description = "Contraseña del usuario admin de Grafana. Obligatoria si enable_monitoring es true."
  type        = string
  default     = null
  sensitive   = true
}

module "monitoring" {
  source = "./monitoring"
  count  = var.enable_monitoring ? 1 : 0

  environment            = var.environment
  prefix                 = local.prefix
  grafana_port           = var.grafana_port
  grafana_admin_password = var.grafana_admin_password
}

output "grafana_url" {
  description = "URL de Grafana (null si la monitorización está desactivada)."
  value       = one(module.monitoring[*].grafana_url)
}
