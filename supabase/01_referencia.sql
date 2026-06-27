-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 01: TABLAS DE REFERENCIA
-- ============================================================================
-- Orden de ejecución: 1 de 6 (sin dependencias externas, es la base de todo)
-- Lección LNT #1: todo valor categórico es tabla de referencia, sin excepción.
-- Convención FK: tabla_destino_id (lección LNT, sin excepción).
-- Fechas: todas en UTC (timestamptz), conversión a horario local en presentación.
-- RLS: habilitado en cada tabla, sin políticas todavía (se definen en etapa posterior).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- GEOGRAFÍA (paises, provincias, localidades)
-- ---------------------------------------------------------------------------

CREATE TABLE paises (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    codigo_iso  TEXT,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE provincias (
    id          BIGSERIAL PRIMARY KEY,
    pais_id     BIGINT NOT NULL REFERENCES paises(id),
    nombre      TEXT NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pais_id, nombre)
);

CREATE TABLE localidades (
    id              BIGSERIAL PRIMARY KEY,
    provincia_id    BIGINT NOT NULL REFERENCES provincias(id),
    nombre          TEXT NOT NULL,
    codigo_postal   TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provincia_id, nombre)
);

-- ---------------------------------------------------------------------------
-- CATÁLOGO (rubros, marcas, unidades de medida, monedas)
-- ---------------------------------------------------------------------------

CREATE TABLE rubros (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marcas (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unidades_medida (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    abreviatura TEXT NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE monedas (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    codigo_iso  TEXT NOT NULL UNIQUE,
    simbolo     TEXT NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- IMPUESTOS
-- ---------------------------------------------------------------------------

CREATE TABLE tasas_iva (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    porcentaje  NUMERIC(5,2) NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE condiciones_iva (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- DISPONIBILIDAD WEB
-- ---------------------------------------------------------------------------

CREATE TABLE estados_disponibilidad_web (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- en_stock / disponible_pronto / bajo_pedido / sin_stock
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- MEDIOS DE PAGO Y TARJETAS
-- ---------------------------------------------------------------------------

CREATE TABLE medios_pago (
    id                      BIGSERIAL PRIMARY KEY,
    nombre                  TEXT NOT NULL UNIQUE,  -- Efectivo, Mercado Pago QR, Transferencia, Tarjeta Naranja, etc.
    fiscaliza_por_defecto   BOOLEAN NOT NULL DEFAULT false,  -- sugerencia de UI, no regla rígida (ver sección ventas)
    activo                  BOOLEAN NOT NULL DEFAULT true,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN medios_pago.fiscaliza_por_defecto IS
    'Valor sugerido al cajero según el medio de pago elegido. La decisión real de fiscalizar
     la toma el cajero al cerrar la venta (acción Guardar vs Fiscalizar), no este campo.';

CREATE TABLE tarjetas (
    id              BIGSERIAL PRIMARY KEY,
    medio_pago_id   BIGINT NOT NULL REFERENCES medios_pago(id),
    nombre          TEXT NOT NULL,  -- Visa, MasterCard, Naranja, Cabal, Maestro MasterCard, etc.
    tipo            TEXT,           -- Crédito / Débito (texto libre por ahora, podría normalizarse después)
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (medio_pago_id, nombre, tipo)
);

CREATE TABLE cuentas_bancarias (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- "Mercado Pago EAV", "Patagonia EAV", alias habitus.sd, etc.
    alias       TEXT,
    banco       TEXT,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- COMPROBANTES Y FISCALIZACIÓN
-- ---------------------------------------------------------------------------

CREATE TABLE tipos_comprobante (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Factura, Nota Débito, Nota Crédito, + 3 variantes MiPyMEs (inactivas)
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE tipos_comprobante IS
    'Se cargan los 6 tipos que ofrece AFIP (Factura, Nota Débito, Nota Crédito,
     Factura/ND/NC de Crédito Electrónica MiPyMEs), pero solo los primeros 3 quedan
     activos=true. Los 3 de MiPyMEs no aplican al negocio (venta al público) y no
     se muestran en la UI, aunque existen en la tabla por completitud de referencia.';

CREATE TABLE estados_fiscales (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Pendiente, Enviado, CAE_Recibido, CAE_Rechazado, Reintentando, Anulado
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE estados_fiscales IS
    'Reemplaza el booleano "fiscalizada". Incluye Anulado para el caso de rechazo
     permanente de AFIP, donde el número de comprobante ya reservado no puede
     reutilizarse (correlatividad fiscal) y debe declararse formalmente anulado.';

CREATE TABLE puntos_venta (
    id              BIGSERIAL PRIMARY KEY,
    sucursal_id     BIGINT,  -- FK se agrega en 02_catalogo_stock.sql vía ALTER, ver nota abajo
    numero          INTEGER NOT NULL UNIQUE,  -- 0003 (Principal Electrónico), 0007 (Enzo, ya no se usa)
    nombre          TEXT NOT NULL,
    es_electronico  BOOLEAN NOT NULL DEFAULT true,
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN puntos_venta.sucursal_id IS
    'FK a sucursales agregada en 02_catalogo_stock.sql porque sucursales se crea en ese archivo.
     Aquí queda como columna sin constraint hasta ese punto.';

-- ---------------------------------------------------------------------------
-- VENTAS — estados
-- ---------------------------------------------------------------------------

CREATE TABLE estados_venta (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_cobro (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_cliente (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Consumidor Final, Cuenta Corriente, etc.
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_precio (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Local, Web, Mayorista, Oferta Web
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- STOCK
-- ---------------------------------------------------------------------------

CREATE TABLE tipos_movimiento_stock (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Ingreso, Egreso, Transferencia
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_movimiento_stock (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Pendiente, Confirmado
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE depositos (
    id              BIGSERIAL PRIMARY KEY,
    sucursal_id     BIGINT,  -- FK se agrega en 02_catalogo_stock.sql, igual que puntos_venta
    nombre          TEXT NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- COMPRAS
-- ---------------------------------------------------------------------------

CREATE TABLE estados_orden_compra (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_orden_compra (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- Rápida, Completa
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- MOVIMIENTOS FINANCIEROS (ledger único)
-- ---------------------------------------------------------------------------

CREATE TABLE categorias_gasto (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- "Compras Mercadería", Empleados, Impuestos, Local Comercial, Marketing, Página Web, Servicios, Sistema
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conceptos_gasto (
    id                  BIGSERIAL PRIMARY KEY,
    categoria_gasto_id  BIGINT NOT NULL REFERENCES categorias_gasto(id),
    nombre              TEXT NOT NULL,  -- Alquiler, Luz, Gas, Agua, Sueldo, AFIP, Faecys, OSECAC, etc.
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (categoria_gasto_id, nombre)
);

CREATE TABLE tipos_entidad (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE  -- Cliente, Proveedor, Empleado, Organismo
);
COMMENT ON TABLE tipos_entidad IS
    'Catálogo cerrado de tipos para el modelo polimórfico entidad_tipo_id + entidad_id
     usado en movimientos. Un trigger en 05_movimientos_financieros.sql valida que
     entidad_id exista en la tabla correspondiente según este tipo.';

CREATE TABLE organismos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,  -- AFIP/ARCA, OSECAC, FAECYS, INACAP, Centro Empleados Comercio
    cuit        TEXT,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TURNOS Y CIERRES DE CAJA
-- ---------------------------------------------------------------------------

CREATE TABLE turnos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE  -- Mañana, Tarde, General
);

CREATE TABLE estados_cierre_turno (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE  -- Abierto, Cerrado, Con diferencia, etc.
);

-- ---------------------------------------------------------------------------
-- SPONSOREO (Team Habitus)
-- ---------------------------------------------------------------------------

CREATE TABLE estados_sponsoreo (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE  -- Activo, Cerrado, etc.
);

-- ---------------------------------------------------------------------------
-- USUARIOS Y ROLES
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE  -- Admin, Encargado
);

CREATE TABLE estados_usuario (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE  -- Activo, Inactivo
);

-- ---------------------------------------------------------------------------
-- SUCURSALES (la tabla en sí se crea acá porque varias FKs de arriba la referencian
-- lógicamente, pero la creamos al final de este archivo para evitar forward-reference;
-- las columnas sucursal_id de puntos_venta y depositos se vinculan en el archivo 02)
-- ---------------------------------------------------------------------------

CREATE TABLE sucursales (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL UNIQUE,  -- "Cinco Saltos" (única hoy, arquitectura lista para más)
    domicilio       TEXT,
    localidad_id    BIGINT REFERENCES localidades(id),
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Vincular ahora las FKs de sucursal_id que quedaron pendientes arriba
-- ---------------------------------------------------------------------------

ALTER TABLE puntos_venta
    ADD CONSTRAINT fk_puntos_venta_sucursal
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);

ALTER TABLE depositos
    ADD CONSTRAINT fk_depositos_sucursal
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);

-- ============================================================================
-- RLS — Habilitar en todas las tablas de este archivo (sin políticas todavía)
-- ============================================================================

ALTER TABLE paises ENABLE ROW LEVEL SECURITY;
ALTER TABLE provincias ENABLE ROW LEVEL SECURITY;
ALTER TABLE localidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubros ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE monedas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasas_iva ENABLE ROW LEVEL SECURITY;
ALTER TABLE condiciones_iva ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_disponibilidad_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE medios_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_comprobante ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_fiscales ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_cobro ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_movimiento_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_movimiento_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_orden_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_orden_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE conceptos_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_entidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE organismos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_cierre_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_sponsoreo ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DATOS INICIALES — valores de referencia confirmados en sesiones de análisis
-- ============================================================================

-- Sucursal única actual
INSERT INTO sucursales (nombre, domicilio) VALUES
    ('Cinco Saltos', 'Av. Roca 54, Cinco Saltos, Río Negro');

-- Puntos de venta (PV 0003 activo electrónico, PV 0007 histórico de Enzo, inactivo)
INSERT INTO puntos_venta (sucursal_id, numero, nombre, es_electronico, activo) VALUES
    ((SELECT id FROM sucursales WHERE nombre = 'Cinco Saltos'), 3, 'Principal (Electrónico)', true, true),
    ((SELECT id FROM sucursales WHERE nombre = 'Cinco Saltos'), 7, 'PV Enzo (histórico)', false, false);

-- Tipos de comprobante (6 totales, solo 3 activos)
INSERT INTO tipos_comprobante (nombre, activo) VALUES
    ('Factura', true),
    ('Nota Débito', true),
    ('Nota Crédito', true),
    ('Factura de Crédito Electrónica (MiPyMEs)', false),
    ('Nota de Débito Electrónica (MiPyMEs)', false),
    ('Nota de Crédito Electrónica (MiPyMEs)', false);

-- Estados fiscales
INSERT INTO estados_fiscales (nombre) VALUES
    ('Pendiente'), ('Enviado'), ('CAE_Recibido'), ('CAE_Rechazado'), ('Reintentando'), ('Anulado');

-- Estados de venta (naming alineado con coverweb: Fiscal / Guardado)
INSERT INTO estados_venta (nombre) VALUES
    ('Fiscal'), ('Guardado'), ('Anulada');

-- Tipos de cliente
INSERT INTO tipos_cliente (nombre) VALUES
    ('Consumidor Final'), ('Cuenta Corriente');

-- Tipos de precio
INSERT INTO tipos_precio (nombre) VALUES
    ('Local'), ('Web'), ('Mayorista'), ('Oferta Web');

-- Tipos y estados de movimiento de stock
INSERT INTO tipos_movimiento_stock (nombre) VALUES
    ('Ingreso'), ('Egreso'), ('Transferencia');

INSERT INTO estados_movimiento_stock (nombre) VALUES
    ('Pendiente'), ('Confirmado');

-- Estados y tipos de orden de compra
INSERT INTO estados_orden_compra (nombre) VALUES
    ('Borrador'), ('Confirmada'), ('Anulada');

INSERT INTO tipos_orden_compra (nombre) VALUES
    ('Rápida'), ('Completa');

-- Categorías y conceptos de gasto
INSERT INTO categorias_gasto (nombre) VALUES
    ('Compras Mercadería'), ('Empleados'), ('Impuestos'), ('Local Comercial'),
    ('Marketing'), ('Página Web'), ('Servicios'), ('Sistema');

INSERT INTO conceptos_gasto (categoria_gasto_id, nombre) VALUES
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Local Comercial'), 'Alquiler'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Servicios'), 'Luz'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Servicios'), 'Gas'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Servicios'), 'Agua'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Empleados'), 'Sueldo'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Impuestos'), 'AFIP'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Impuestos'), 'Faecys'),
    ((SELECT id FROM categorias_gasto WHERE nombre = 'Impuestos'), 'OSECAC');

-- Tipos de entidad (modelo polimórfico de movimientos)
INSERT INTO tipos_entidad (nombre) VALUES
    ('Cliente'), ('Proveedor'), ('Empleado'), ('Organismo');

-- Organismos
INSERT INTO organismos (nombre) VALUES
    ('AFIP/ARCA'), ('OSECAC'), ('FAECYS'), ('INACAP'), ('Centro Empleados de Comercio');

-- Turnos
INSERT INTO turnos (nombre) VALUES
    ('Mañana'), ('Tarde'), ('General');

INSERT INTO estados_cierre_turno (nombre) VALUES
    ('Abierto'), ('Cerrado sin diferencia'), ('Cerrado con diferencia');

-- Estados de sponsoreo
INSERT INTO estados_sponsoreo (nombre) VALUES
    ('Activo'), ('Cerrado');

-- Roles y estados de usuario
INSERT INTO roles (nombre) VALUES
    ('Admin'), ('Encargado');

INSERT INTO estados_usuario (nombre) VALUES
    ('Activo'), ('Inactivo');

-- Moneda base
INSERT INTO monedas (nombre, codigo_iso, simbolo) VALUES
    ('Peso Argentino', 'ARS', '$');

-- Medios de pago reales del negocio
INSERT INTO medios_pago (nombre, fiscaliza_por_defecto) VALUES
    ('Efectivo', false),
    ('Mercado Pago QR', true),
    ('Mercado Pago Débito', true),
    ('Mercado Pago Crédito', true),
    ('Transferencia Mercado Pago EAV', true),
    ('Transferencia Patagonia EAV', false),
    ('Tarjeta Naranja', true),
    ('Banco Patagonia', false),
    ('OpenPay', true);

-- Cuentas bancarias / alias
INSERT INTO cuentas_bancarias (nombre, alias) VALUES
    ('Mercado Pago EAV', 'habitus.sd'),
    ('Patagonia EAV', 'habitus.patagonia'),
    ('Camino Doce Doce', 'camino.doce.doce');

-- ============================================================================
-- FIN DEL ARCHIVO 01
-- Siguiente paso: ejecutar 02_catalogo_stock.sql
-- ============================================================================
