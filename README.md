## Práctica 1

Primero de todo ejecutamos los siguientes comandos:

-> docker pull nginx

Descarga desde Docker Hub la imagen de Nginx (revisando previamente que es seguro). Nginx es un servidor web y proxy inverso de código abierto y alto rendimiento.
Ahora si ejecutamos 'docker images' veremos que tenemos la imagen descargada.


-> docker run --name mynginx -d -p 8080:80 nginx

docker run -> crea un contenedor nuevo a partir de una imagen y lo arranca. En este caso busca una imagen llamada nginx.
          -> --name myginx le asigna el nombre 'myginx', de esta manera, podremos ejecutar comandos de manera mucho más rápida en lugar de identificar el contenedor con un ID largo.
          -> -d significa detached mode, és decir, ejecuta el contenedor en segundo plano (Devuelve el control de la terminal en vez de mostrar directamente lo que está haciendo).
          -> -p 8080:80 esta opción publica el puerto del contenedor, o un rango de puertos, al host. En este caso, mapeamos el puerto 8080 de nuestro ordenador (host) con el puerto 80 del contenedor.
                        De esta manera, Docker recibe la petición en 8080 de nuestro ordenador y la dirige al 80 del contenedor, al realizar localhost:8080.

Ahora que tenemos el contenedor arrancado y con las opciones seleccionadas, podemos realizar docker ps para ver un listado de los contenedores que tenemos ejecutando en ese momento. Si añadimos -a
al comando anterior, veremos el historial completo de contenedores (incluso los que no se están ejecutando).

Comprobamos que el contenedor está arrancado, por tanto si vamos a nuestro navegador de confianza y escribimos http://localhost:8080/ nos encontraremos con nuestra página WEB! :O

Esto sucede gracias al mapeo anterior, nuestro navegador envía la petición al puerto 8080 de nuestro ordenador, pero docker está escuchando/intermediando para ese puerto, por tanto, docker envía la conexión
al contenedor.
El contenedor mynginx, que está escuchando en el puerto 80, recibe la petición y busca el recurso por defecto /usr/share/nginx/html/index.html (ya que no hemos modificado nada de ese aspecto), acto seguido
de encontrar el recurso, mynginx devuelve una respuesta HTTP al navegador, el cual, finalmente el navegador interpreta el .html y muestra la página.
