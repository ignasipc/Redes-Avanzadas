.PHONY: up-dev up-prod destroy-dev destroy-prod

# Levanta el entorno de desarrollo (web + MySQL, sin Redis).
up-dev:
	terraform -chdir=environments/dev init
	terraform -chdir=environments/dev plan -out=tfplan
	@printf "¿Aplicar este plan? [y/N] "; read r; [ "$$r" = "y" ] || { echo "Cancelado."; exit 1; }
	terraform -chdir=environments/dev apply tfplan

# Levanta el entorno de producción (web + MySQL + Redis).
up-prod:
	terraform -chdir=environments/prod init
	terraform -chdir=environments/prod plan -out=tfplan
	@printf "¿Aplicar este plan? [y/N] "; read r; [ "$$r" = "y" ] || { echo "Cancelado."; exit 1; }
	terraform -chdir=environments/prod apply tfplan

# Elimina el entorno de desarrollo (contenedores, red, imagen y volúmenes).
destroy-dev:
	terraform -chdir=environments/dev destroy

# Elimina el entorno de producción (contenedores, red, imagen y volúmenes).
destroy-prod:
	terraform -chdir=environments/prod destroy