-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 02: CATÁLOGO / STOCK / USUARIOS / CLIENTES / PROVEEDORES
-- ============================================================================
-- Orden de ejecución: 2 de 6 (depende de 01_referencia.sql + 01b_geografia_arg.sql)
-- Convención FK: tabla_destino_id (lección LNT, sin excepción) — única excepción:
-- usuarios.id es UUID porque referencia auth.users(id) de Supabase Auth.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- USUARIOS — perfil de negocio vinculado a Supabase Auth (auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE usuarios (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id),
    nombre_completo     TEXT NOT NULL,
    dni_cuit            TEXT,
    rol_id              BIGINT NOT NULL REFERENCES roles(id),
    sucursal_id         BIGINT REFERENCES sucursales(id),
    estado_usuario_id   BIGINT NOT NULL REFERENCES estados_usuario(id),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE usuarios IS
    'Perfil de negocio del usuario. La autenticación (email, password, sesión, tokens)
     la maneja Supabase Auth (auth.users) por completo; esta tabla solo guarda los
     datos de negocio (nombre, DNI/CUIT, rol, sucursal) vinculados 1 a 1 por id.';

-- ---------------------------------------------------------------------------
-- ARTÍCULOS — modelo de 5 secciones (Identificación / Precios / Disponibilidad / Stock / Datos adicionales)
-- ---------------------------------------------------------------------------

CREATE TABLE articulos (
    id                  BIGSERIAL PRIMARY KEY,

    -- Identificación
    nombre              TEXT NOT NULL,
    nombre_base         TEXT,  -- agrupa variantes/sabores en la vitrina web sin tabla aparte
    rubro_id            BIGINT NOT NULL REFERENCES rubros(id),
    marca_id            BIGINT NOT NULL REFERENCES marcas(id),
    codigo_interno      TEXT UNIQUE,
    codigo_barra        TEXT UNIQUE,
    sku                 TEXT UNIQUE,

    -- Precios
    costo_sin_iva       NUMERIC(12,2) NOT NULL DEFAULT 0,
    tasa_iva_id         BIGINT NOT NULL REFERENCES tasas_iva(id),
    precio_local        NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio_web          NUMERIC(12,2),  -- default = precio_local, ver trigger más abajo
    precio_mayorista    NUMERIC(12,2),
    precio_oferta_web   NUMERIC(12,2),

    -- Disponibilidad
    disponible_local    BOOLEAN NOT NULL DEFAULT true,
    disponible_web      BOOLEAN NOT NULL DEFAULT true,
    visible_en_tienda   BOOLEAN NOT NULL DEFAULT true,

    -- Web (atributo de variante, ej. sabor)
    id_producto_web     TEXT,
    id_stock_web        TEXT,
    atributo_nombre     TEXT,  -- ej. "Sabor"
    atributo_valor      TEXT,  -- ej. "Chocolate"
    peso_kg             NUMERIC(8,3),

    -- Datos adicionales
    descripcion         TEXT,

    activo              BOOLEAN NOT NULL DEFAULT true,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN articulos.nombre_base IS
    'Agrupa variantes/sabores en la vitrina web. Las variantes son artículos
     separados en la base de datos (con stock independiente cada una); se agrupan
     SOLO visualmente en la web por este campo, sin tabla aparte.';

-- Trigger: precio_web default = precio_local cuando no se especifica explícitamente
CREATE OR REPLACE FUNCTION fn_articulos_default_precio_web()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.precio_web IS NULL THEN
        NEW.precio_web := NEW.precio_local;
    END IF;
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articulos_default_precio_web
    BEFORE INSERT OR UPDATE ON articulos
    FOR EACH ROW
    EXECUTE FUNCTION fn_articulos_default_precio_web();

-- ---------------------------------------------------------------------------
-- IMÁGENES DE ARTÍCULO — tabla separada (NO campo único, corrección de diseño)
-- ---------------------------------------------------------------------------

CREATE TABLE articulo_imagenes (
    id              BIGSERIAL PRIMARY KEY,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    orden           INTEGER NOT NULL DEFAULT 0,
    es_principal    BOOLEAN NOT NULL DEFAULT false,
    alt_text        TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantiza una sola imagen principal por artículo
CREATE UNIQUE INDEX idx_articulo_imagenes_principal_unica
    ON articulo_imagenes (articulo_id)
    WHERE es_principal = true;

-- ---------------------------------------------------------------------------
-- STOCK POR SUCURSAL
-- ---------------------------------------------------------------------------

CREATE TABLE articulo_stock (
    id              BIGSERIAL PRIMARY KEY,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    sucursal_id     BIGINT NOT NULL REFERENCES sucursales(id),
    stock_actual    NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_min       NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_max       NUMERIC(12,2),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (articulo_id, sucursal_id)
);

-- ---------------------------------------------------------------------------
-- PRECIOS POR SUCURSAL — estructura lista, inactiva (hoy todos los precios son iguales)
-- ---------------------------------------------------------------------------

CREATE TABLE articulo_precio_sucursal (
    id              BIGSERIAL PRIMARY KEY,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    sucursal_id     BIGINT NOT NULL REFERENCES sucursales(id),
    tipo_precio_id  BIGINT NOT NULL REFERENCES tipos_precio(id),
    precio          NUMERIC(12,2) NOT NULL,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (articulo_id, sucursal_id, tipo_precio_id)
);
COMMENT ON TABLE articulo_precio_sucursal IS
    'Estructura lista para precios diferenciados por sucursal. Hoy con una sola
     sucursal no se usa (los precios viven directamente en articulos.precio_*);
     queda preparada para cuando haya más de una sucursal con precios distintos.';

-- ---------------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------------

CREATE TABLE clientes (
    id                  BIGSERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL,
    tipo_cliente_id     BIGINT NOT NULL REFERENCES tipos_cliente(id),
    cuit                TEXT,
    dni                 TEXT,
    condicion_iva_id    BIGINT REFERENCES condiciones_iva(id),
    domicilio           TEXT,
    localidad_id        BIGINT REFERENCES localidades(id),
    telefono            TEXT,
    email               TEXT,
    tiene_cuenta_corriente  BOOLEAN NOT NULL DEFAULT false,
    plazo_dias_cta_cte      INTEGER,  -- ej. 15-30 días, solo aplica si tiene_cuenta_corriente=true
    descuento_default_pct  NUMERIC(5,2),  -- descuento variable por venta, ej. Municipalidad
    notas               TEXT,
    activo              BOOLEAN NOT NULL DEFAULT true,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cliente genérico obligatorio: Consumidor Final
INSERT INTO clientes (nombre, tipo_cliente_id, tiene_cuenta_corriente)
VALUES (
    'Consumidor Final',
    (SELECT id FROM tipos_cliente WHERE nombre = 'Consumidor Final'),
    false
);

-- ---------------------------------------------------------------------------
-- PROVEEDORES — solo nombre_comercial obligatorio, resto opcional
-- ---------------------------------------------------------------------------

CREATE TABLE proveedores (
    id              BIGSERIAL PRIMARY KEY,
    nombre_comercial TEXT NOT NULL UNIQUE,
    cuit            TEXT,
    razon_social    TEXT,
    domicilio       TEXT,
    cbu_alias       TEXT,
    telefono        TEXT,
    email           TEXT,
    notas           TEXT,
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Vincular ahora la FK pendiente: sucursales.responsable_usuario_id
-- (se agrega acá porque usuarios recién se acaba de crear en este archivo)
-- ============================================================================

ALTER TABLE sucursales
    ADD COLUMN responsable_usuario_id UUID REFERENCES usuarios(id);

COMMENT ON COLUMN sucursales.responsable_usuario_id IS
    'Encargado/jefe designado de la sucursal. Es un dato organizativo estable,
     distinto de quién hizo el cierre de turno en un día puntual (cierres_turno.usuario_id).
     Puede o no coincidir con quien atiende como vendedor.';

-- ============================================================================
-- RLS — Habilitar en todas las tablas de este archivo (sin políticas todavía)
-- ============================================================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulo_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulo_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulo_precio_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIN DEL ARCHIVO 02
-- Siguiente paso: ejecutar 03_ventas_comprobantes.sql
-- ============================================================================
