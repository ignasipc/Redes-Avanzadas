output "web_url" {
  description = "URL de la aplicación DEV."
  value       = module.aquarium.web_url
}

output "grafana_url" {
  value = module.aquarium.grafana_url
}