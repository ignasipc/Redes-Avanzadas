.PHONY: setup build up-dev up-prod down down-dev down-prod logs-dev logs-prod ps-dev ps-prod clean

COMPOSE_DEV = docker-compose.dev.yml
COMPOSE_PROD = docker-compose.prod.yml

# Crea los .env locales solo si no existen. En esta práctica se parte de valores de ejemplo.
setup:
	@test -f .env.dev || cp .env.dev.example .env.dev
	@test -f .env.prod || cp .env.prod.example .env.prod

build: setup
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) build
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) build

up-dev: setup
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) up -d --build

up-prod: setup
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) up -d --build

down-dev: setup
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) down

down-prod: setup
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) down

down: down-dev down-prod

logs-dev: setup
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) logs -f

logs-prod: setup
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) logs -f

ps-dev: setup
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) ps

ps-prod: setup
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) ps

# ATENCIÓN: elimina también los volúmenes y, por tanto, los datos de MySQL.
clean: setup
	docker compose -p aquarium-dev --env-file .env.dev -f $(COMPOSE_DEV) down -v
	docker compose -p aquarium-prod --env-file .env.prod -f $(COMPOSE_PROD) down -v
