import os
from decimal import Decimal, InvalidOperation

import mysql.connector
from flask import Flask, jsonify, render_template, request
from mysql.connector import Error as MySQLError
from redis import Redis
from redis.exceptions import RedisError

app = Flask(__name__)

APP_ENV = os.getenv("APP_ENV", "dev").strip().lower()
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def get_db_connection():
    """Open a MySQL connection using settings supplied through environment variables."""
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "db"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        database=os.environ["MYSQL_DATABASE"],
        connection_timeout=3,
    )


def serialize_fish(row):
    """Convert a database row into JSON-friendly Python values."""
    fish = dict(row)
    fish["id"] = int(fish["id"])
    fish["price"] = float(fish["price"])
    fish["stock"] = int(fish["stock"])
    return fish


def get_all_fish():
    connection = get_db_connection()
    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """SELECT id, name, species, water_type, temperature, price, stock, description
               FROM fish ORDER BY name ASC, id ASC"""
        )
        return cursor.fetchall()
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def get_fish_by_id(connection, fish_id):
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """SELECT id, name, species, water_type, temperature, price, stock, description
               FROM fish WHERE id = %s""",
            (fish_id,),
        )
        row = cursor.fetchone()
        return serialize_fish(row) if row else None
    finally:
        cursor.close()


def error_response(message, status_code):
    return jsonify(error=message), status_code


@app.get("/")
def index():
    catalog_error = None
    try:
        fish_list = get_all_fish()
    except MySQLError:
        app.logger.exception("No se ha podido cargar el catálogo desde MySQL")
        fish_list = []
        catalog_error = "No se ha podido cargar el catálogo desde MySQL. Comprueba el estado de la base de datos."

    return render_template(
        "index.html",
        fish_list=fish_list,
        environment=APP_ENV,
        catalog_error=catalog_error,
    )


@app.get("/status")
def status():
    database_status = "disconnected"
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        try:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            database_status = "connected"
        finally:
            cursor.close()
            connection.close()
    except (MySQLError, KeyError, ValueError):
        app.logger.warning("La comprobación de MySQL ha fallado", exc_info=True)

    cache_status = "not_enabled"
    if CACHE_ENABLED:
        try:
            redis_client = Redis(
                host=os.getenv("REDIS_HOST", "cache"),
                port=int(os.getenv("REDIS_PORT", "6379")),
                socket_connect_timeout=1,
                socket_timeout=1,
                decode_responses=True,
            )
            redis_client.ping()
            cache_status = "connected"
        except (RedisError, ValueError):
            cache_status = "disconnected"
        finally:
            try:
                redis_client.close()
            except (UnboundLocalError, AttributeError):
                pass

    healthy = database_status == "connected" and (not CACHE_ENABLED or cache_status == "connected")
    return jsonify(
        status="healthy" if healthy else "unhealthy",
        database=database_status,
        cache=cache_status,
    ), (200 if healthy else 503)


@app.post("/api/fish")
def create_fish():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error_response("Se esperaba un objeto JSON con los datos del pez.", 400)

    name = str(payload.get("name", "")).strip()
    species = str(payload.get("species", "")).strip()
    water_type = str(payload.get("water_type", "")).strip().lower()
    temperature = str(payload.get("temperature", "")).strip().lower()
    description = str(payload.get("description", "")).strip()

    if not name or len(name) > 100:
        return error_response("El nombre es obligatorio y no puede superar los 100 caracteres.", 400)
    if not species or len(species) > 150:
        return error_response("La especie es obligatoria y no puede superar los 150 caracteres.", 400)
    if water_type not in {"dulce", "salada"}:
        return error_response("El tipo de agua debe ser 'dulce' o 'salada'.", 400)
    if temperature not in {"fria", "calida"}:
        return error_response("La temperatura debe ser 'fria' o 'calida'.", 400)
    if len(description) > 500:
        return error_response("La descripción no puede superar los 500 caracteres.", 400)

    try:
        price = Decimal(str(payload.get("price", "")))
        if not price.is_finite() or price < 0 or price > Decimal("99999999.99"):
            raise InvalidOperation
        price = price.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return error_response("El precio debe ser un número válido igual o superior a cero.", 400)

    raw_stock = payload.get("stock")
    try:
        if isinstance(raw_stock, bool) or str(raw_stock).strip() == "":
            raise ValueError
        stock = int(raw_stock)
        if str(stock) != str(raw_stock).strip() or stock < 0 or stock > 4294967295:
            raise ValueError
    except (TypeError, ValueError):
        return error_response("El stock debe ser un número entero igual o superior a cero.", 400)

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (name, species, water_type, temperature, price, stock, description or None),
        )
        fish_id = cursor.lastrowid
        connection.commit()
        fish = get_fish_by_id(connection, fish_id)
        return jsonify(fish=fish), 201
    except MySQLError:
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.exception("No se ha podido guardar el pez en MySQL")
        return error_response("No se ha podido guardar el pez en la base de datos.", 503)
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.patch("/api/fish/<int:fish_id>/stock")
def update_stock(fish_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or payload.get("delta") not in (-1, 1):
        return error_response("El cambio de stock debe ser +1 o -1.", 400)

    delta = int(payload["delta"])
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        # El cambio es atómico y no permite que el stock sea negativo.
        cursor.execute(
            "UPDATE fish SET stock = stock + %s WHERE id = %s AND stock + %s >= 0",
            (delta, fish_id, delta),
        )
        if cursor.rowcount != 1:
            connection.rollback()
            cursor.execute("SELECT stock FROM fish WHERE id = %s", (fish_id,))
            row = cursor.fetchone()
            if row is None:
                return error_response("No se ha encontrado ese pez en el catálogo.", 404)
            return error_response("El stock ya es cero; no se puede reducir más.", 409)

        connection.commit()
        fish = get_fish_by_id(connection, fish_id)
        return jsonify(fish=fish)
    except MySQLError:
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.exception("No se ha podido actualizar el stock en MySQL")
        return error_response("No se ha podido actualizar el stock.", 503)
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.delete("/api/fish/<int:fish_id>")
def delete_fish(fish_id):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM fish WHERE id = %s", (fish_id,))
        if cursor.rowcount != 1:
            connection.rollback()
            return error_response("No se ha encontrado ese pez en el catálogo.", 404)
        connection.commit()
        return jsonify(ok=True, id=fish_id)
    except MySQLError:
        if connection is not None and connection.is_connected():
            connection.rollback()
        app.logger.exception("No se ha podido eliminar el pez de MySQL")
        return error_response("No se ha podido eliminar el pez.", 503)
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    # Útil para ejecutar localmente en modo de desarrollo. En Docker se usa Gunicorn.
    app.run(host="0.0.0.0", port=5000, debug=(APP_ENV == "dev"))
