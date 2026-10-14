## Previa a la Practica 1 🐳

<p align="center">
  <img src="https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png" width="150">
</p>

<p align="center">
  <strong> GESTIÓN DE MÁQUINAS VIRTUALES </strong>
</p>

En este apartado comenzaremos con unos ejercicios previos antes de empezar con la **Práctica 1**, cuyo enunciado no se nos ha proporcionado directamente. En su lugar, se ha planteado mediante una serie de pequeñas tareas de dificultad incremental, a las que llamaremos **ejemplos**, que nos servirán de guía y nos permitirán avanzar progresivamente hasta tener la capacidad de enfrentarnos a la **Práctica 1**.

Para completar las tareas, deberemos tener previamente instalados **Docker Engine** junto con **Docker Compose**. Por preferencia personal, he decidido <u>no utilizar <strong>Docker Desktop</strong></u>, al considerar que, desde una perspectiva de aprendizaje, resulta más beneficioso trabajar directamente mediante comandos. De esta forma, puedo comprender mejor qué sucede en cada paso, en lugar de utilizar una interfaz gráfica que simplifica y oculta parte de la funcionalidad, dificultando la comprensión de lo que ocurre realmente en segundo plano.

A lo largo de esta práctica, iré comentando paso a paso cómo he realizado cada uno de los ejemplos, describiendo los comandos utilizados y explicando los procesos seguidos, con el objetivo de comprender no solo cómo llevarlos a cabo, sino también qué sucede en cada etapa, hasta completar finalmente la Práctica 1.

### Seguimiento
 - [Ejemplo 1](#ejemplo-1---descarga-y-ejecución-de-un-contenedor)
 - [Ejemplo 2](#ejemplo-2---construcción-de-una-imagen-personalizada)
 - [Ejemplo 3](#ejemplo-3---web-y-base-de-datos)
 - [Ejemplo 4](#ejemplo-4---variables-de-entorno)
 - [Ejemplo 5](#ejemplo-5---makefile)

 ---

## Ejemplo 1 - Descarga y ejecución de un contenedor

Primero de todo ejecutamos los dos siguientes comandos:

```bash
docker pull nginx
```

Descarga desde [Docker Hub](https://hub.docker.com) la imagen de [Nginx](https://hub.docker.com/hardened-images/catalog/dhi/nginx) (un servidor web y proxy inverso de código abierto y alto rendimiento), revisando previamente que es seguro claro 🤣. Ahora, si ejecutamos `docker images` veremos que tenemos la imagen descargada.


```bash
docker run --name mynginx -d -p 8080:80 nginx
```

Vamos a desglosar el comando anterior:

- `docker run`: crea un contenedor nuevo a partir de una imagen y lo arranca. En este caso busca una imagen llamada nginx (aparece al final del comando).

- `--name mynginx`: le asigna el nombre 'mynginx', de esta manera, podremos ejecutar comandos de manera mucho más rápida en lugar de identificar el contenedor con un ID largo.

- `-d`: significa _detached mode_, es decir, ejecuta el contenedor en segundo plano (Devuelve el control de la terminal en vez de mostrar directamente lo que está haciendo). Como lo ejecutaremos en segundo plano, Docker nos devolverá por la terminal el **ID único y completo del contenedor**, sin truncar.

- `-p 8080:80`: esta opción publica el puerto del contenedor, o un rango de puertos, al host. En este caso, **mapeamos** el puerto **8080** de nuestro ordenador (host) con el puerto **80** del contenedor. De esta manera, Docker recibe la petición en 8080 de nuestro ordenador y la dirige al 80 del contenedor al realizar **localhost:8080**.

Ahora que tenemos el contenedor arrancado y con las opciones seleccionadas, podemos realizar `docker ps` para ver un listado de los contenedores que tenemos ejecutando en ese momento. Si añadimos `-a`
al final del comando anterior, veremos el historial completo de contenedores (incluso los que no se están ejecutando). En nuestro caso, podremos comprobar que mynginx aparece en la lista y que su estado (**_STATUS_**) figura como **_Up_**, indicando que el contenedor se encuentra en ejecución.

Comprobado que el contenedor se encuentra correctamente en ejecución, podemos abrir nuestro navegador de confianza y acceder a http://localhost:8080. Si todo ha funcionado correctamente, se mostrará la página web de bienvenida de **Nginx**. ¡Ya tenemos nuestro servidor web funcionando! 🤩

<p align="center">
  <img src="PrePractice1/imagesPreP1/bienvenidaNginx.png" 
       alt="Página web de bienvenida de Nginx">
</p>

#### Explicación

Esto sucede gracias al mapeo anterior, nuestro navegador envía la petición al **puerto 8080** de nuestro ordenador, pero docker está escuchando/intermediando para ese puerto, por tanto, docker envía la conexión
al contenedor.

El contenedor mynginx, que está escuchando en el **puerto 80**, recibe la petición y busca el recurso por defecto /usr/share/nginx/html/index.html (ya que no hemos modificado nada de ese aspecto), acto seguido de encontrarlo, mynginx devuelve una respuesta HTTP al navegador, el cual, interpreta el .html y muestra la página.

##### Limpieza

Ahora que hemos terminado, podemos parar la ejecución del contenedor con el comando `docker stop mynginx`. Acto seguido desechamos el contenedor eliminándolo con el comando `docker rm mynginx`. Cabe mencionar que debemos tener muy en cuenta que **TODOS** los datos que estén dentro de la capa _writable_, una capa de almacenamiento temporal y modificable que Docker añade encima de la imagen cuando crea un contenedor, serán **ELIMINADOS**. En cambio, si tenemos guardados los datos en un **VOLUMEN** <u><strong>NO</strong> serán eliminados</u>! Finalmente, eliminaremos la imagen guardada en cache mediante el comando `docker rmi nginx`, que no eliminará los volúmenes que se pudieran haber creado.  Todavía no hemos creado volúmenes, por tanto, no es necesario realizar nada más. Cabe mencionar que no suele hacerse éste último paso, ya que las imágenes suelen ser reutilizables, mientras que los contenedores son desechables.

---

## Ejemplo 2 - Construcción de una imagen personalizada

### ⚠️ **A partir de aquí las instrucciones están INCOMPLETAS, serán completadas más adelante al terminar y tener tiempo para hacerlo, sólamente habrá explicación muy breve** ⚠️

En este ejemplo, conseguiremos construir una imagen personalizada a partir de un Dockerfile, que tendrá el siguiente contenido:

```
FROM nginx:latest
COPY index.html /usr/share/nginx/html/index.html
```

*Explicar que hace FROM, :latest y por que es conveniente o no y COPY


Además añadiremos el archivo index.html con el código de una página web personalizada:

```
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<title>Mi Primer Contenedor Docker</title>
</head>
<body>
	<h1>¡Hola, Docker!</h1>
</body>
</html>
```

Ahra que tenemos los archivos necesarios que hemos personalizado ya podemos crear la imagen y ejecutar un contenedor de esa imagen con los comandos:

```
docker build -t mynginximage .
```

* describir el comando, -t y .

Y ejecutamos el contenedor:

```
docker run --name mynginximage -d -p 8080:80 mynginximage
```

* describir el comando

Finalmente, ahora que el contenedor está ejecutandose, si vamos a http://localhost:8080 en nuestro navegador de confianza veremos nuestra página web personalizada funciona correctamente! 🤩

<p align="center">
  <img src="PrePractice1/imagesPreP1/hiDockerWeb.png" 
       alt="Página web personalizada">
</p>

* Explicación 

* Limpieza igual que en el exemplo 1

---

## Ejemplo 3 - Web y base de datos

En este ejemplo simularemos una pequeña app con una web y una base de datos mediante docker compose.

Para ello tendremos que añadir un archivo nuevo llamado docker-compose.yml con el siguiente código:

```
version: '3.9'

services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    networks:
      - internal_net
    depends_on:
      - db

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: testdb
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - internal_net

networks:
  internal_net:

volumes:
  db_data:
```

En este archivo de docker compose, lo que sucede es que creamos dos contenedores `web` y `db`. Que se conectan entre ellos mediante una red privada llamada `internal_net`. También contamos con `volumes: db_data:/var/lib/mysql`: monta un volumen persistente en el directorio donde MySQL almacena sus datos.

Contamos aquí ya con **volumenes**: un volumen es un mecanismo para almacenar datos de forma persistente, independientemente del ciclo de vida de un contenedor

Ahora ejecutamos el siguiente comando:

```
docker compose up -d
```

Docker Compose realizará los siguientes pasos con tu archivo docker-compose.yml:

Como las imágenes no están disponibles localmente, Docker Compose las descarga desde un registro, normalmente Docker Hub, antes de crear los contenedores.

1. Crea la red internal_net, si todavía no existe.
2. Crea el volumen db_data, si todavía no existe.
3. Crea e inicia el contenedor db, que ejecuta MySQL.
4. Crea e inicia el contenedor web, que ejecuta Nginx.
5. Ambos contenedores quedan ejecutándose en segundo plano.

El parámetro `-d` (detached) permite que los contenedores se ejecuten sin mantener la terminal ocupada.

Ahora que tenemos los contenedores ejecutándose, si realizamos el comando `curl localhost:8080` realiza una petición HTTP al servidor Nginx y muestra en la terminal el contenido de la respuesta, en este caso, HTML.

Si ejecutamos el comando `docker network ls` veremos el listado de redes existentes. Vemos que nuestra red interna `internal_net` se llama `practica1_internal_net` debido a que se encuentra en la carpeta de **Practica 1**. Si ejecutamos el comando `docker network inspect practica1_internal_net` Docker nos devolverá información detallada, incluyendo los contenedores conectados a esa red, sus direcciones IP y la configuración de la red.

Ejecutamos el comando `docker ps` para ver cual es el ID de la base de datos del contenedor que hemos creado. Vemos que se llama `practica1-db-1`.

Ahora si ejecutamos el comando `docker exec -it practica1-db-1 mysql -u root -p`:

¿Qué hace cada parte?
- docker exec: ejecuta un comando dentro de un contenedor que ya está en funcionamiento.
- -it: permite interactuar con el proceso desde la terminal.
- <db-id>: identificador o nombre del contenedor de MySQL. Debes sustituirlo por el valor real; no escribas los símbolos < y >.
- mysql: inicia el cliente de línea de comandos de MySQL.
- -u root: indica que quieres conectarte con el usuario root.
- -p: solicita la contraseña de ese usuario.


Lo que nos encontramos primero es la petición de la contraseña para poder acceder a la base de datos, la cual hemos establecido anteriormente en nuestro docker-compose.yml que és `root`. Si la introducimos correctamente, entraremos en el cliente de MySQL.

Donde podremos realizar los comandos:

- `SHOW DATABASES`: Que nos lista las basesde datos que tenemos. El cual nos enseñará:

```
mysql> SHOW DATABASES;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| performance_schema |
| sys                |
| testdb             |
+--------------------+
5 rows in set (0.00 sec)

mysql> USE testdb;
Database changed

mysql> SHOW TABLES;
Empty set (0.00 sec)
```

Antes de seguir con los ejemplos, vamos a parar y eliminar lo que hemos creado en este ejemplo.

`docker compose stop`: Detiene los contenedores, conservando los recursos.

`docker compose down`: Detiene y elimina los contenedores y la red del proyecto. Conserva los volúmenes.

`docker compose down -v`: También elimina los volúmenes declarados por el proyecto, por lo que podrías perder los datos de MySQL.

`docker compose down --rmi all -v`: Si quieres eliminar los contenedores, la red, las imágenes utilizadas por los servicios y los volúmenes.

---

## Ejemplo 4 - Variables de entorno

En este nuevo ejemplo, contamos con un entorno con dos servicios: Nginx + MySQL. Igual que en el ejemplo anterior.

Y la tarea que debemos realizar será parametrizar credenciales y el puerto web mediante variables de entorno.

Para conseguir realizarlo, creamos un archivo que contendrá las variables de entorno llamado `.env`, su contenido será el siguiente:

```
WEB_PORT=8081

MYSQL_ROOT_PASSWORD=myrootpass
MYSQL_DATABASE=mydb

MYSQL_USER=myuser
MYSQL_PASSWORD=mypass
```

⚠️ Ésto son datos **MUY SENSIBLES** al contener contraseñas de acceso a la base de datos, por lo tanto es <u>absolutamente necesario</u> añadirlo en el `.gitignore`. Es por esto que los datos mostrados anteriormente son puramente ilustrativos y **NO** son los que están guardados en mi máquina local ⚠️

Ahora vamos a modificar el archivo `docker-compose.yml` que creamos en el ejemplo anterior. Deberemos utilizar la sintaxis `${NOMBRE_VARIABLE}`. Por lo tanto, cambiamos las siguientes líneas de código:

```
ports:
      - "${WEB_PORT}:80"

MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}

```

Ahora debemos montar el `./html/`, que utilizamos en el ejemplo 2, en `/usr/share/nginx/html` añadiendo en el docker-compose.yml la siguiente línea:

```
volumes:
      - ./html:/usr/share/nginx/html
```

Ahora añadimos un Healthcheck mediante las siguientes líneas de código que insertaremos en el contenedor web del docker-compose.yml:

```
healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://localhost/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

Para usar el volúmen db_data haremos lo siguiente:



Finalmente crearemos una carpeta llamada `html` donde moveremos el .html que creamos en el ejemplo2.

Listo, ya tenemos listo el ejemplo 4. Solo hace falta **Comprobar que funciona correctamente**.

---

## Ejemplo 5 - Makefile


En este ejemplo aprendemos a usar el `Makefile` para así poder automatizar comandos de Docker Compose de manera que el despliegue, parada y limpieza del entorno puedan realizarse con un solo comando. Debemos conocer que Make no gestiona las máquinas virtuales ni Docker Compose, sino que simplemente ejecuta comandos.

Dicho esto, creamos un archivo llamado `Makefile` con el siguiente contenido:

```
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
```

Es importante mencionar que las tabulaciones deben ser tabs, no espacios, ya que Make las requiere.

Ahora vamos a separar la configuración de Docker Compose en dos archivos: uno para desarrollo (dev) y otro para producción (prod). De este modo, podremos levantar el entorno local de desarrollo con su configuración específica y mantener diferenciada la configuración destinada a producción.

```
COMPOSE_FILE = docker-compose.yml
COMPOSE_DEV = docker-compose.dev.yml
COMPOSE_PROD = docker-compose.prod.yml

up:
	docker compose -f $(COMPOSE_FILE) up -d

up-dev:
	docker compose -f $(COMPOSE_DEV) up -d

up-prod:
	docker compose -f $(COMPOSE_PROD) up -d
```

Ya hemos terminado los ejercicios previos antes de la práctica! Ahora debemos empezar con la práctica 1!
