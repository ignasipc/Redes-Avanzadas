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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_fish_price_nonnegative CHECK (price >= 0)
);

-- Datos iniciales de ejemplo para que el catálogo no aparezca vacío en el primer despliegue.
-- Los INSERT son idempotentes: si el script se vuelve a ejecutar, no duplica esas fichas.
INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
SELECT 'Pez payaso', 'Amphiprion ocellaris', 'salada', 'calida', 24.99, 8,
       'Pez marino tropical, conocido por su color naranja y blanco.'
WHERE NOT EXISTS (
    SELECT 1 FROM fish WHERE name = 'Pez payaso' AND species = 'Amphiprion ocellaris'
);

INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
SELECT 'Guppy', 'Poecilia reticulata', 'dulce', 'calida', 4.50, 12,
       'Pez tropical de agua dulce, pequeño y vivíparo.'
WHERE NOT EXISTS (
    SELECT 1 FROM fish WHERE name = 'Guppy' AND species = 'Poecilia reticulata'
);

INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
SELECT 'Pez globo', 'Diodon holocanthus', 'salada', 'calida', 19.99, 3,
       'Pez marino de cuerpo robusto.'
WHERE NOT EXISTS (
    SELECT 1 FROM fish WHERE name = 'Pez globo' AND species = 'Diodon holocanthus'
);

INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
SELECT 'Pez dorado', 'Carassius auratus', 'dulce', 'fria', 8.99, 5,
       'Pez de agua dulce que requiere espacio y filtración adecuados.'
WHERE NOT EXISTS (
    SELECT 1 FROM fish WHERE name = 'Pez dorado' AND species = 'Carassius auratus'
);

INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
SELECT 'Pez betta', 'Betta splendens', 'dulce', 'calida', 12.00, 0,
       'Pez tropical de agua dulce; actualmente agotado.'
WHERE NOT EXISTS (
    SELECT 1 FROM fish WHERE name = 'Pez betta' AND species = 'Betta splendens'
);

INSERT INTO fish (name, species, water_type, temperature, price, stock, description)
SELECT 'Neón chino', 'Tanichthys albonubes', 'dulce', 'fria', 3.25, 29,
       'Pez pequeño de agua dulce que tolera temperaturas frescas.'
WHERE NOT EXISTS (
    SELECT 1 FROM fish WHERE name = 'Neón chino' AND species = 'Tanichthys albonubes'
);
