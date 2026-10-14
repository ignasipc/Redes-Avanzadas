-- La imagen oficial de MySQL ejecuta este script dentro de MYSQL_DATABASE
-- cuando inicializa por primera vez un directorio de datos vacío.

CREATE TABLE IF NOT EXISTS fish (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(150) NOT NULL,
    water_type ENUM('dulce', 'salada') NOT NULL,
    temperature ENUM('fria', 'calida') NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT UNSIGNED NOT NULL DEFAULT 0,
    description VARCHAR(500) NULL,
    image_data LONGBLOB NULL,
    image_mime_type VARCHAR(50) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_fish_price_nonnegative CHECK (price >= 0)
);

-- Datos iniciales de ejemplo para que el catálogo no aparezca vacío en el primer despliegue.
-- Los INSERT son idempotentes: si el script se vuelve a ejecutar, no duplica esas fichas.
INSERT INTO fish (
    name, species, water_type, temperature, price, stock, description,
    image_data, image_mime_type
)
SELECT
    'Pez payaso', 'Amphiprion ocellaris', 'salada', 'calida', 24.99, 8,
    'Pez marino tropical, conocido por su color naranja y blanco.',
    LOAD_FILE('/var/lib/mysql-files/pez-payaso.jpg'), 'image/jpeg'
WHERE NOT EXISTS (
    SELECT 1 FROM fish
    WHERE name = 'Pez payaso' AND species = 'Amphiprion ocellaris'
);

INSERT INTO fish (
    name, species, water_type, temperature, price, stock, description,
    image_data, image_mime_type
)
SELECT
    'Guppy', 'Poecilia reticulata', 'dulce', 'calida', 4.50, 12,
    'Pez tropical de agua dulce, pequeño y vivíparo.',
    LOAD_FILE('/var/lib/mysql-files/guppy.jpg'), 'image/jpeg'
WHERE NOT EXISTS (
    SELECT 1 FROM fish
    WHERE name = 'Guppy' AND species = 'Poecilia reticulata'
);

INSERT INTO fish (
    name, species, water_type, temperature, price, stock, description,
    image_data, image_mime_type
)
SELECT
    'Pez globo', 'Diodon holocanthus', 'salada', 'calida', 19.99, 3,
    'Pez marino de cuerpo robusto.',
    LOAD_FILE('/var/lib/mysql-files/pez-globo.jpg'), 'image/jpeg'
WHERE NOT EXISTS (
    SELECT 1 FROM fish
    WHERE name = 'Pez globo' AND species = 'Diodon holocanthus'
);

INSERT INTO fish (
    name, species, water_type, temperature, price, stock, description,
    image_data, image_mime_type
)
SELECT
    'Pez dorado', 'Carassius auratus', 'dulce', 'fria', 8.99, 5,
    'Pez de agua dulce que requiere espacio y filtración adecuados.',
    LOAD_FILE('/var/lib/mysql-files/pez-dorado.jpg'), 'image/jpeg'
WHERE NOT EXISTS (
    SELECT 1 FROM fish
    WHERE name = 'Pez dorado' AND species = 'Carassius auratus'
);

INSERT INTO fish (
    name, species, water_type, temperature, price, stock, description,
    image_data, image_mime_type
)
SELECT
    'Pez betta', 'Betta splendens', 'dulce', 'calida', 12.00, 0,
    'Pez tropical de agua dulce; actualmente agotado.',
    LOAD_FILE('/var/lib/mysql-files/pez-betta.jpg'), 'image/jpeg'
WHERE NOT EXISTS (
    SELECT 1 FROM fish
    WHERE name = 'Pez betta' AND species = 'Betta splendens'
);

INSERT INTO fish (
    name, species, water_type, temperature, price, stock, description,
    image_data, image_mime_type
)
SELECT
    'Neón chino', 'Tanichthys albonubes', 'dulce', 'fria', 3.25, 29,
    'Pez pequeño de agua dulce que tolera temperaturas frescas.',
    LOAD_FILE('/var/lib/mysql-files/neon-chino.jpg'), 'image/jpeg'
WHERE NOT EXISTS (
    SELECT 1 FROM fish
    WHERE name = 'Neón chino' AND species = 'Tanichthys albonubes'
);
