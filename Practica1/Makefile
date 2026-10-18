COMPOSE_DEV = docker-compose.dev.yml
COMPOSE_PROD = docker-compose.prod.yml

# Comprueba los requisitos y prepara ambos entornos.
setup:
	@echo "========== Comprobando requisitos =========="
	@command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker no está instalado."; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "ERROR: Docker no está iniciado o no tienes permisos."; exit 1; }
	@docker compose version >/dev/null 2>&1 || { echo "ERROR: Docker Compose no está disponible."; exit 1; }
	@test -f .env.dev || { echo "ERROR: Falta .env.dev."; exit 1; }
	@test -f .env.prod || { echo "ERROR: Falta .env.prod."; exit 1; }
	@test -f $(COMPOSE_DEV) || { echo "ERROR: Falta $(COMPOSE_DEV)."; exit 1; }
	@test -f $(COMPOSE_PROD) || { echo "ERROR: Falta $(COMPOSE_PROD)."; exit 1; }
	@echo "========== Validando configuración =========="
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) config -q
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) config -q

# Muestra el estado general de los recursos de Docker.
show-docker-status:
	@echo "========== CONTENEDORES =========="
	docker ps -a
	@echo ""
	@echo "========== IMÁGENES =========="
	docker images
	@echo ""
	@echo "========== VOLÚMENES =========="
	docker volume ls

# Inicia el entorno de desarrollo.
up-dev:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) up -d --build

# Inicia el entorno de producción.
up-prod:
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) up -d --build

# Comprueba la conexión y ejecuta una consulta en MySQL.
test-db-dev:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) exec db sh -c 'mysql --protocol=tcp -h 127.0.0.1 -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" "$$MYSQL_DATABASE" -e "SELECT 1 AS conexion_correcta;"'

# Comprueba la conexión y ejecuta una consulta en MySQL en producción.
test-db-prod:
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) exec db sh -c 'mysql --protocol=tcp -h 127.0.0.1 -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" "$$MYSQL_DATABASE" -e "SELECT 1 AS conexion_correcta;"'

# Detiene y elimina los contenedores y redes de desarrollo.
down-dev:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) down

# Detiene y elimina los contenedores y redes de producción.
down-prod:
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) down

# Detiene y elimina los contenedores y redes de ambos entornos.
down: down-dev down-prod

# Construye las imágenes de ambos entornos.
build:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) build
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) build

# Muestra los logs de desarrollo.
logs-dev:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) logs -f

# Muestra los logs de producción.
logs-prod:
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) logs -f

# Muestra el estado de los servicios de desarrollo.
ps-dev:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) ps

# Muestra el estado de los servicios de producción.
ps-prod:
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) ps

# ATENCIÓN: detiene ambos entornos y elimina contenedores, redes, volúmenes e imágenes asociadas.
purge-all:
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) stop
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) stop
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) down --rmi all -v
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) down --rmi all -v

