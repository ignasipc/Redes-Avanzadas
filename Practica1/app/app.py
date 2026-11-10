import base64
import json
import os
import re
import threading
from decimal import Decimal, InvalidOperation

import mysql.connector
from flask import Flask, jsonify, render_template, request, Response
from mysql.connector import Error as MySQLError
from redis import Redis
from redis.exceptions import RedisError

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MiB por imagen

APP_ENV = os.getenv('APP_ENV', 'dev').strip().lower()
CACHE_ENABLED = os.getenv('CACHE_ENABLED', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
CATALOG_CACHE_KEY = 'aquarium:catalog:v1'
CACHE_TTL = int(os.getenv('CACHE_TTL_SECONDS', '0'))  # 0 = sin caducidad
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
# Debe coincidir con el tipo INT UNSIGNED de la columna fish.stock en MySQL.
MAX_STOCK = 4_294_967_295
_CACHE_RECONCILIATION_REQUIRED = CACHE_ENABLED
_CACHE_RECONCILIATION_LOCK = threading.Lock()
_IMAGE_INVALIDATION_TABLE_READY = False


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('MYSQL_HOST', 'db'),
        port=int(os.getenv('MYSQL_PORT', '3306')),
        user=os.environ['MYSQL_USER'],
        password=os.environ['MYSQL_PASSWORD'],
        database=os.environ['MYSQL_DATABASE'],
        connection_timeout=3,
    )


def get_cache():
    if not CACHE_ENABLED:
        return None
    return Redis(
        host=os.getenv('REDIS_HOST', 'cache'),
        port=int(os.getenv('REDIS_PORT', '6379')),
        socket_connect_timeout=1,
        socket_timeout=1,
        decode_responses=False,
    )

def mark_cache_reconciliation_required():
    """Marca la caché para revisar sus claves cuando Redis vuelva a estar disponible."""
    global _CACHE_RECONCILIATION_REQUIRED
    if CACHE_ENABLED:
        _CACHE_RECONCILIATION_REQUIRED = True


def cache_set(key, value, ex=None):
    if not CACHE_ENABLED:
        return False
    client = None
    try:
        client = get_cache()
        client.set(key, value, ex=(ex or CACHE_TTL) or None)
        return True
    except RedisError:
        mark_cache_reconciliation_required()
        app.logger.warning('No se ha podido actualizar la caché Redis', exc_info=True)
        return False
    finally:
        if client:
            client.close()


def cache_get(key):
    if not CACHE_ENABLED:
        return None
    client = None
    try:
        client = get_cache()
        return client.get(key)
    except RedisError:
        mark_cache_reconciliation_required()
        app.logger.warning('No se ha podido leer la caché Redis', exc_info=True)
        return None
    finally:
        if client:
            client.close()


def ensure_image_cache_invalidations_table(connection):
    """Crea una sola vez la cola durable de invalidaciones en cada worker."""
    global _IMAGE_INVALIDATION_TABLE_READY
    if _IMAGE_INVALIDATION_TABLE_READY:
        return
    cursor = connection.cursor()
    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fish_image_cache_invalidations (
                fish_id INT UNSIGNED NOT NULL PRIMARY KEY,
                invalidated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        ''')
        connection.commit()
        _IMAGE_INVALIDATION_TABLE_READY = True
    finally:
        cursor.close()



def reconcile_orphaned_image_cache():
    """Elimina claves Redis de imágenes que ya no tienen una imagen en MySQL.

    Se ejecuta al arrancar la aplicación y cuando se detecta una caída de Redis.
    La comprobación se hace solo cuando MySQL y Redis están disponibles.
    """
    global _CACHE_RECONCILIATION_REQUIRED
    if not CACHE_ENABLED or not _CACHE_RECONCILIATION_REQUIRED:
        return True
    if not _CACHE_RECONCILIATION_LOCK.acquire(blocking=False):
        return True

    connection = None
    cursor = None
    client = None
    try:
        connection = get_db_connection()
        ensure_image_columns(connection)
        cursor = connection.cursor(dictionary=True)
        cursor.execute('''
            SELECT id
            FROM fish
            WHERE image_data IS NOT NULL AND OCTET_LENGTH(image_data) > 0
        ''')
        valid_image_ids = {int(row['id']) for row in cursor.fetchall()}

        client = get_cache()
        client.ping()
        stale_ids = set()
        for key in client.scan_iter(match='aquarium:fish:*:image', count=200):
            key_text = key.decode('utf-8') if isinstance(key, bytes) else str(key)
            match = re.fullmatch(r'aquarium:fish:(\d+):image', key_text)
            if match and int(match.group(1)) not in valid_image_ids:
                stale_ids.add(int(match.group(1)))

        if stale_ids:
            pipeline = client.pipeline(transaction=True)
            for fish_id in stale_ids:
                pipeline.delete(
                    f'aquarium:fish:{fish_id}:image',
                    f'aquarium:fish:{fish_id}:mime',
                )
            pipeline.execute()
            app.logger.info(
                'Reconciliación de Redis: eliminadas %s imágenes huérfanas',
                len(stale_ids),
            )

        # También reconstruye el catálogo cacheado para no conservar peces borrados
        # si Redis volvió mientras MySQL estaba caído.
        cursor.execute('''
            SELECT id, name, species, water_type, temperature, price, stock,
                   description, image_mime_type
            FROM fish
            ORDER BY name ASC, id ASC
        ''')
        current_catalog = [serialize_fish(row) for row in cursor.fetchall()]
        client.set(
            CATALOG_CACHE_KEY,
            json.dumps(current_catalog, ensure_ascii=False).encode('utf-8'),
            ex=CACHE_TTL or None,
        )

        _CACHE_RECONCILIATION_REQUIRED = False
        return True
    except (MySQLError, RedisError, KeyError, ValueError):
        _CACHE_RECONCILIATION_REQUIRED = True
        app.logger.warning('No se ha podido reconciliar la caché de imágenes', exc_info=True)
        return False
    finally:
        if client is not None:
            client.close()
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()
        _CACHE_RECONCILIATION_LOCK.release()


def process_pending_image_invalidations():
    """Elimina de Redis imágenes de peces borrados, incluso tras una caída de Redis.

    La cola se guarda en MySQL, por lo que sobrevive a la caída/recreación de Redis
    y puede procesarla cualquier worker de Gunicorn cuando ambos servicios vuelvan.
    """
    if not CACHE_ENABLED:
        return True

    connection = None
    cursor = None
    catalog_cursor = None
    client = None
    try:
        connection = get_db_connection()
        ensure_image_cache_invalidations_table(connection)
        cursor = connection.cursor()
        cursor.execute(
            'SELECT fish_id FROM fish_image_cache_invalidations ORDER BY invalidated_at'
        )
        fish_ids = [int(row[0]) for row in cursor.fetchall()]
        if not fish_ids:
            return True

        client = get_cache()
        client.ping()
        pipeline = client.pipeline(transaction=True)
        for fish_id in fish_ids:
            pipeline.delete(
                f'aquarium:fish:{fish_id}:image',
                f'aquarium:fish:{fish_id}:mime',
            )
        pipeline.execute()

        # Solo se eliminan las marcas pendientes después de confirmar el borrado en Redis.
        cursor.executemany(
            'DELETE FROM fish_image_cache_invalidations WHERE fish_id = %s',
            [(fish_id,) for fish_id in fish_ids],
        )

        # Refresca también el catálogo: el borrado pudo haberse hecho mientras
        # Redis estaba caído y su copia anterior todavía contiene el pez eliminado.
        catalog_cursor = connection.cursor(dictionary=True)
        catalog_cursor.execute('''
            SELECT id, name, species, water_type, temperature, price, stock,
                   description, image_mime_type
            FROM fish
            ORDER BY name ASC, id ASC
        ''')
        current_catalog = [serialize_fish(row) for row in catalog_cursor.fetchall()]
        client.set(
            CATALOG_CACHE_KEY,
            json.dumps(current_catalog, ensure_ascii=False).encode('utf-8'),
            ex=CACHE_TTL or None,
        )
        connection.commit()
        app.logger.info(
            'Caché de imágenes reconciliada: %s invalidación(es) procesada(s)',
            len(fish_ids),
        )
        return True
    except (MySQLError, RedisError, KeyError, ValueError):
        mark_cache_reconciliation_required()
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.warning(
            'No se han podido procesar las invalidaciones pendientes de imágenes',
            exc_info=True,
        )
        return False
    finally:
        if client is not None:
            client.close()
        if catalog_cursor is not None:
            catalog_cursor.close()
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


def ensure_image_columns(connection):
    """Migración automática para instalaciones existentes con volumen MySQL persistente."""
    cursor = connection.cursor()
    try:
        cursor.execute('''
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fish'
              AND COLUMN_NAME IN ('image_data', 'image_mime_type')
        ''')
        existing = {row[0] for row in cursor.fetchall()}
        if 'image_data' not in existing:
            cursor.execute('ALTER TABLE fish ADD COLUMN image_data LONGBLOB NULL')
        if 'image_mime_type' not in existing:
            cursor.execute('ALTER TABLE fish ADD COLUMN image_mime_type VARCHAR(50) NULL')
        connection.commit()
    finally:
        cursor.close()


def serialize_fish(row):
    fish = dict(row)
    fish['id'] = int(fish['id'])
    fish['price'] = float(fish['price'])
    fish['stock'] = int(fish['stock'])
    # No se incluyen los bytes de la imagen en la respuesta del catálogo.
    fish.pop('image_data', None)
    return fish


def cache_catalog(fish_list):
    if CACHE_ENABLED:
        cache_set(CATALOG_CACHE_KEY, json.dumps(fish_list, ensure_ascii=False).encode('utf-8'))


def get_all_fish(connection=None):
    owns_connection = connection is None
    connection = connection or get_db_connection()
    cursor = None
    try:
        ensure_image_columns(connection)
        cursor = connection.cursor(dictionary=True)
        cursor.execute('''SELECT id, name, species, water_type, temperature, price, stock,
                                 description, image_mime_type
                          FROM fish ORDER BY name ASC, id ASC''')
        rows = [serialize_fish(row) for row in cursor.fetchall()]
        cache_catalog(rows)
        return rows
    finally:
        if cursor:
            cursor.close()
        if owns_connection:
            connection.close()


def get_fish_by_id(connection, fish_id):
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute('''SELECT id, name, species, water_type, temperature, price, stock,
                                 description, image_mime_type
                          FROM fish WHERE id = %s''', (fish_id,))
        row = cursor.fetchone()
        return serialize_fish(row) if row else None
    finally:
        cursor.close()


def error_response(message, status_code):
    return jsonify(error=message), status_code


def cached_catalog():
    raw = cache_get(CATALOG_CACHE_KEY)
    if not raw:
        return None
    try:
        return json.loads(raw.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        app.logger.warning('La caché del catálogo no tiene un formato válido')
        return None


@app.get('/')
def index():
    offline_mode = False
    catalog_error = None
    try:
        fish_list = get_all_fish()
    except (MySQLError, KeyError, ValueError):
        app.logger.warning('MySQL no está disponible; se intentará usar la caché', exc_info=True)
        fish_list = cached_catalog() if CACHE_ENABLED else None
        if fish_list is not None:
            offline_mode = True
            catalog_error = ('MySQL está caído. Mostrando datos en caché (nombre, stock e imágenes). '
                             'Modo de solo lectura: los cambios están deshabilitados y no se guardarían.')
        else:
            fish_list = []
            offline_mode = True
            catalog_error = ('MySQL no está disponible y todavía no hay un catálogo en caché. '
                             'No se pueden consultar ni modificar los datos.')
    return render_template('index.html', fish_list=fish_list, environment=APP_ENV,
                           catalog_error=catalog_error, offline_mode=offline_mode)


@app.get('/status')
def status():
    database_status = 'disconnected'
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        try:
            cursor.execute('SELECT 1')
            cursor.fetchone()
            database_status = 'connected'
        finally:
            cursor.close()
            connection.close()
    except (MySQLError, KeyError, ValueError):
        pass

    cache_status = 'not_enabled'
    cache_available = False
    if CACHE_ENABLED:
        client = None
        try:
            client = get_cache()
            client.ping()
            cache_status = 'connected'
            cache_available = True
        except (RedisError, ValueError):
            mark_cache_reconciliation_required()
            cache_status = 'disconnected'
        finally:
            if client:
                client.close()

    # Cuando MySQL y Redis vuelven a estar disponibles, procesa las invalidaciones
    # pendientes. La cola está en MySQL y no depende de que el worker que recibe
    # /status sea el mismo que intentó borrar la imagen durante la caída.
    if CACHE_ENABLED and database_status == 'connected' and cache_status == 'connected':
        reconcile_orphaned_image_cache()
        process_pending_image_invalidations()

    read_only = database_status != 'connected'
    offline_cache_available = bool(read_only and cache_available and cache_get(CATALOG_CACHE_KEY))
    healthy = database_status == 'connected' and (not CACHE_ENABLED or cache_status == 'connected')
    return jsonify(status='healthy' if healthy else 'unhealthy', database=database_status,
                   cache=cache_status, read_only=read_only,
                   offline_cache_available=offline_cache_available), (200 if healthy else 503)


@app.get('/fish/<int:fish_id>/image')
def fish_image(fish_id):
    # Antes de servir una imagen cacheada, procesa borrados que quedaron pendientes
    # mientras Redis estaba desconectado. Si MySQL sigue caído, la función no borra
    # nada y se puede seguir usando la imagen cacheada para el modo offline.
    if CACHE_ENABLED:
        reconcile_orphaned_image_cache()
        process_pending_image_invalidations()

    image_key = f'aquarium:fish:{fish_id}:image'
    mime_key = f'aquarium:fish:{fish_id}:mime'
    cached_image = cache_get(image_key)
    cached_mime = cache_get(mime_key)
    if cached_image:
        return Response(cached_image, mimetype=(cached_mime or b'image/jpeg').decode('ascii', 'ignore'),
                        headers={'Cache-Control': 'no-cache'})

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        ensure_image_columns(connection)
        cursor = connection.cursor()
        cursor.execute('SELECT image_data, image_mime_type FROM fish WHERE id = %s', (fish_id,))
        row = cursor.fetchone()
        if not row or not row[0]:
            return '', 404
        image_data, mime_type = bytes(row[0]), (row[1] or 'image/jpeg')
        cache_set(image_key, image_data)
        cache_set(mime_key, mime_type.encode('ascii'))
        return Response(image_data, mimetype=mime_type, headers={'Cache-Control': 'no-cache'})
    except (MySQLError, KeyError, ValueError):
        # No hay imagen en caché y MySQL no responde.
        return '', 503
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.post('/api/fish')
def create_fish():
    # Acepta JSON (clientes antiguos) y multipart/form-data (con imagen).
    payload = request.form if request.form else request.get_json(silent=True)
    if not hasattr(payload, 'get'):
        return error_response('Se esperaban los datos del pez.', 400)

    name = str(payload.get('name', '')).strip()
    species = str(payload.get('species', '')).strip()
    water_type = str(payload.get('water_type', '')).strip().lower()
    temperature = str(payload.get('temperature', '')).strip().lower()
    description = str(payload.get('description', '')).strip()
    if not name or len(name) > 100:
        return error_response('El nombre es obligatorio y no puede superar los 100 caracteres.', 400)
    if not species or len(species) > 150:
        return error_response('La especie es obligatoria y no puede superar los 150 caracteres.', 400)
    if water_type not in {'dulce', 'salada'}:
        return error_response("El tipo de agua debe ser 'dulce' o 'salada'.", 400)
    if temperature not in {'fria', 'calida'}:
        return error_response("La temperatura debe ser 'fria' o 'calida'.", 400)
    if len(description) > 500:
        return error_response('La descripción no puede superar los 500 caracteres.', 400)
    try:
        price = Decimal(str(payload.get('price', '')))
        if not price.is_finite() or price < 0 or price > Decimal('99999999.99'):
            raise InvalidOperation
        price = price.quantize(Decimal('0.01'))
        raw_stock = payload.get('stock')
        if isinstance(raw_stock, bool) or str(raw_stock).strip() == '':
            raise ValueError
        stock = int(raw_stock)
        if str(stock) != str(raw_stock).strip() or stock < 0 or stock > MAX_STOCK:
            raise ValueError
    except (InvalidOperation, ValueError, TypeError):
        return error_response('El precio o el stock no tienen un formato válido.', 400)

    image_data = None
    image_mime_type = None
    image = request.files.get('image') if request.files else None
    if image and image.filename:
        image_mime_type = image.mimetype.lower()
        if image_mime_type not in ALLOWED_IMAGE_TYPES:
            return error_response('La imagen debe ser JPG, PNG o WebP.', 400)
        image_data = image.read()
        if not image_data:
            return error_response('El archivo de imagen está vacío.', 400)
        if len(image_data) > 5 * 1024 * 1024:
            return error_response('La imagen no puede superar los 5 MB.', 413)

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        ensure_image_columns(connection)
        cursor = connection.cursor()
        cursor.execute('''INSERT INTO fish
            (name, species, water_type, temperature, price, stock, description, image_data, image_mime_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            (name, species, water_type, temperature, price, stock, description or None,
             image_data, image_mime_type))
        fish_id = cursor.lastrowid
        connection.commit()
        fish = get_fish_by_id(connection, fish_id)
        rows = get_all_fish(connection)
        if image_data:
            cache_set(f'aquarium:fish:{fish_id}:image', image_data)
            cache_set(f'aquarium:fish:{fish_id}:mime', image_mime_type.encode('ascii'))
        return jsonify(fish=fish), 201
    except MySQLError:
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.exception('No se ha podido guardar el pez en MySQL')
        return error_response('No se ha podido guardar el pez en la base de datos.', 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.patch('/api/fish/<int:fish_id>/stock')
def update_stock(fish_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or payload.get('delta') not in (-1, 1):
        return error_response('El cambio de stock debe ser +1 o -1.', 400)
    delta = int(payload['delta'])
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        if delta == 1:
            # La condición se evalúa dentro del UPDATE: evita el desbordamiento
            # de INT UNSIGNED incluso si llegan dos incrementos simultáneos.
            cursor.execute(
                'UPDATE fish SET stock = stock + 1 WHERE id = %s AND stock < %s',
                (fish_id, MAX_STOCK),
            )
        else:
            cursor.execute(
                'UPDATE fish SET stock = stock - 1 WHERE id = %s AND stock > 0',
                (fish_id,),
            )

        if cursor.rowcount != 1:
            connection.rollback()
            cursor.execute('SELECT stock FROM fish WHERE id = %s', (fish_id,))
            row = cursor.fetchone()
            if row is None:
                return error_response('No se ha encontrado ese pez en el catálogo.', 404)
            current_stock = int(row[0])
            if delta == 1 and current_stock >= MAX_STOCK:
                return error_response(
                    f'El stock ha alcanzado el máximo permitido ({MAX_STOCK} unidades).',
                    409,
                )
            if delta == -1 and current_stock <= 0:
                return error_response('El stock ya es cero; no se puede reducir más.', 409)
            return error_response('No se ha podido modificar el stock por un conflicto con su valor actual.', 409)
        connection.commit()
        fish = get_fish_by_id(connection, fish_id)
        get_all_fish(connection)  # refresca el snapshot del catálogo en Redis
        return jsonify(fish=fish)
    except MySQLError:
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.exception('No se ha podido actualizar el stock en MySQL')
        return error_response('MySQL no está disponible. El cambio no se ha guardado.', 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete('/api/fish/<int:fish_id>')
def delete_fish(fish_id):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if CACHE_ENABLED:
            ensure_image_cache_invalidations_table(connection)
        cursor = connection.cursor()
        cursor.execute('DELETE FROM fish WHERE id = %s', (fish_id,))
        if cursor.rowcount != 1:
            connection.rollback()
            return error_response('No se ha encontrado ese pez en el catálogo.', 404)

        if CACHE_ENABLED:
            # La marca se confirma junto con el DELETE. Si Redis está caído, queda
            # guardada en MySQL para que otro worker la procese cuando Redis vuelva.
            cursor.execute(
                '''INSERT INTO fish_image_cache_invalidations (fish_id)
                   VALUES (%s)
                   ON DUPLICATE KEY UPDATE invalidated_at = CURRENT_TIMESTAMP''',
                (fish_id,),
            )

        connection.commit()
        if CACHE_ENABLED:
            process_pending_image_invalidations()
        get_all_fish(connection)
        return jsonify(ok=True, id=fish_id)
    except MySQLError:
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.exception('No se ha podido eliminar el pez de MySQL')
        return error_response('MySQL no está disponible. El cambio no se ha guardado.', 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.errorhandler(413)
def request_too_large(_error):
    return error_response('La petición supera el límite de 5 MB.', 413)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=(APP_ENV == 'dev'))