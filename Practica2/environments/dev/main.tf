# Entorno DEV: web + MySQL, sin Redis.
# Solo instancia el módulo con los valores propios de este entorno.

module "aquarium" {
  source = "../../modules"

  environment         = "dev"
  enable_cache        = false
  web_port            = 8081
  mysql_database      = "aquarium_db_dev"
  mysql_user          = "ignasiDev"
  mysql_password      = var.mysql_password
  mysql_root_password = var.mysql_root_password
}
