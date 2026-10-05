# Nombre del archivo: Makefile
COMPOSE_FILE = docker-compose.yml

up:
	docker compose -f $(COMPOSE_FILE) up -d

down:
	docker compose -f $(COMPOSE_FILE) down

build:
	docker compose -f $(COMPOSE_FILE) build

logs:
	docker compose -f $(COMPOSE_FILE) logs -f

ps:
	docker compose -f $(COMPOSE_FILE) ps

clean:
	docker compose -f $(COMPOSE_FILE) down -v
	docker system prune -f
