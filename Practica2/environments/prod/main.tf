# Entorno PROD: web + MySQL + Redis (caché).
# Solo instancia el módulo con los valores propios de este entorno.

module "aquarium" {
  source = "../../modules"

  environment         = "prod"
  enable_cache        = true
  web_port            = 8080
  mysql_database      = "aquarium_db"
  mysql_user          = "ignasi"
  mysql_password      = var.mysql_password
  mysql_root_password = var.mysql_root_password
}
