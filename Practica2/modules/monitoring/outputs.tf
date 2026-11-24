output "metrics_network" {
  description = "Red interna de métricas. HAProxy se une a ella para que Prometheus pueda consultarlo."
  value       = docker_network.metrics.name
}

output "grafana_url" {
  description = "URL de Grafana en el host."
  value       = "http://localhost:${var.grafana_port}"
}
