show-docker-status:
	@echo "========== CONTENEDORES =========="
	docker ps -a
	@echo ""
	@echo "========== IMÁGENES =========="
	docker images
	@echo ""
	@echo "========== VOLÚMENES =========="
	docker volume ls

build:
	docker compose -p nginx --env-file .env -f docker-compose.yml build

up:
	docker compose -p nginx --env-file .env -f docker-compose.yml up -d --build

down:
	docker compose -p nginx --env-file .env -f docker-compose.yml down

purge:
	docker compose -p nginx --env-file .env -f docker-compose.yml stop
	docker compose -p nginx --env-file .env -f docker-compose.yml down --rmi all -v
