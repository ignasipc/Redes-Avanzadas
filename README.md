# Práctica 1 🐳

<p align="center">
  <img src="https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png" width="150">
</p>

<p align="center">
  <strong> GESTIÓN DE MÁQUINAS VIRTUALES </strong>
</p>

Para comenzar con la Práctica 1, no se nos ha entregado directamente el enunciado, sino que se ha subdividido ....



Primero de todo ejecutamos los dos siguientes comandos:

```bash
docker pull nginx
```

Descarga desde Docker Hub la imagen de Nginx (revisando previamente que es seguro).
Ahora si ejecutamos `docker images veremos que tenemos la imagen descargada. 

Nginx es un servidor web y proxy inverso de código abierto y alto rendimiento.

```bash
docker run --name mynginx -d -p 8080:80 nginx
```

Vamos a desglosar el comando anterior
docker run -> crea un contenedor nuevo a partir de una imagen y lo arranca. En este caso busca una imagen llamada nginx.
          -> --name mynginx le asigna el nombre 'mynginx', de esta manera, podremos ejecutar comandos de manera mucho más rápida en lugar de identificar el contenedor con un ID largo.
          -> -d significa detached mode, es decir, ejecuta el contenedor en segundo plano (Devuelve el control de la terminal en vez de mostrar directamente lo que está haciendo).
          -> -p 8080:80 esta opción publica el puerto del contenedor, o un rango de puertos, al host. En este caso, mapeamos el puerto 8080 de nuestro ordenador (host) con el puerto 80 del contenedor.
                        De esta manera, Docker recibe la petición en 8080 de nuestro ordenador y la dirige al 80 del contenedor, al realizar localhost:8080.

Ahora que tenemos el contenedor arrancado y con las opciones seleccionadas, podemos realizar docker ps para ver un listado de los contenedores que tenemos ejecutando en ese momento. Si añadimos -a
al comando anterior, veremos el historial completo de contenedores (incluso los que no se están ejecutando).

Comprobamos que el contenedor está arrancado, por tanto si vamos a nuestro navegador de confianza y escribimos http://localhost:8080/ nos encontraremos con nuestra página WEB! :O

Esto sucede gracias al mapeo anterior, nuestro navegador envía la petición al puerto 8080 de nuestro ordenador, pero docker está escuchando/intermediando para ese puerto, por tanto, docker envía la conexión
al contenedor.
El contenedor mynginx, que está escuchando en el puerto 80, recibe la petición y busca el recurso por defecto /usr/share/nginx/html/index.html (ya que no hemos modificado nada de ese aspecto), acto seguido
de encontrar el recurso, mynginx devuelve una respuesta HTTP al navegador, el cual, finalmente el navegador interpreta el .html y muestra la página.

Ahora que hemos terminado, podemos parar la ejecución del contenedor con el comando docker stop mynginx.
Acto seguido desechamos el contenedor eliminándolo con el comando docker rm mynginx. Cabe mencionar que debemos tener muy en cuenta que TODOS los datos que estén dentro de la capa writable serán ELIMINADOS.
En cambio si tenemos guardados los datos en un VOLUMEN NO serán eliminados!
Finalmente, eliminaremos la imagen guardada en cache mediante el comando docker rmi nginx.
