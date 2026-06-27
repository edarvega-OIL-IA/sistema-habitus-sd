-- ============================================================================
-- HABITUS SD — SCRIPT DE INSTALACIÓN COMPLETO PARA PRODUCCIÓN
-- ============================================================================
-- Versión: 27/06/2026 — refleja el estado real de producción al cierre sesión 13
-- Reemplaza: 01 al 15 + fix_retiro
-- Uso: ejecutar en una BD vacía para recrear producción desde cero
-- ADVERTENCIA: NO ejecutar sobre una BD con datos — usar solo en instalación limpia
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABLAS DE REFERENCIA
-- ============================================================================

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

CREATE TABLE estados_disponibilidad_web (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medios_pago (
    id                      BIGSERIAL PRIMARY KEY,
    nombre                  TEXT NOT NULL UNIQUE,
    fiscaliza_por_defecto   BOOLEAN NOT NULL DEFAULT false,
    activo                  BOOLEAN NOT NULL DEFAULT true,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE emisores_pago (
    id        BIGSERIAL PRIMARY KEY,
    nombre    TEXT NOT NULL,
    fiscaliza BOOLEAN NOT NULL DEFAULT false,
    activo    BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tarjetas (
    id              BIGSERIAL PRIMARY KEY,
    medio_pago_id   BIGINT NOT NULL REFERENCES medios_pago(id),
    nombre          TEXT NOT NULL,
    tipo            TEXT,
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (medio_pago_id, nombre, tipo)
);

CREATE TABLE cuentas_bancarias (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    alias       TEXT,
    banco       TEXT,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_comprobante (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_fiscales (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_precio (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_movimiento_stock (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_movimiento_stock (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subtipos_movimiento_stock (
    id                       BIGSERIAL PRIMARY KEY,
    tipo_movimiento_stock_id BIGINT NOT NULL REFERENCES tipos_movimiento_stock(id),
    nombre                   TEXT NOT NULL,
    activo                   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE depositos (
    id          BIGSERIAL PRIMARY KEY,
    sucursal_id BIGINT,  -- FK se agrega después de crear sucursales
    nombre      TEXT NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_orden_compra (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tipos_orden_compra (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias_gasto (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    tipo        TEXT NOT NULL DEFAULT 'Egreso',  -- Ingreso/Egreso/Ambos/Sistema
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conceptos_gasto (
    id                  BIGSERIAL PRIMARY KEY,
    categoria_gasto_id  BIGINT NOT NULL REFERENCES categorias_gasto(id),
    nombre              TEXT NOT NULL,
    tipo                TEXT NOT NULL DEFAULT 'Egreso',  -- Ingreso/Egreso/Ambos/Sistema
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (categoria_gasto_id, nombre)
);

CREATE TABLE tipos_entidad (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organismos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    cuit        TEXT,
    tipo        TEXT,
    notas       TEXT,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE turnos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_cierre_turno (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_sponsoreo (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estados_usuario (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sucursales (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL UNIQUE,
    domicilio       TEXT,
    localidad_id    BIGINT REFERENCES localidades(id),
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE puntos_venta (
    id              BIGSERIAL PRIMARY KEY,
    sucursal_id     BIGINT REFERENCES sucursales(id),
    numero          INTEGER NOT NULL UNIQUE,
    nombre          TEXT NOT NULL,
    es_electronico  BOOLEAN NOT NULL DEFAULT true,
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE depositos ADD CONSTRAINT fk_depositos_sucursal FOREIGN KEY (sucursal_id) REFERENCES sucursales(id);

CREATE TABLE transportistas (
    id        BIGSERIAL PRIMARY KEY,
    nombre    TEXT NOT NULL,
    activo    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE deportes (
    id        BIGSERIAL PRIMARY KEY,
    nombre    TEXT NOT NULL,
    activo    BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- PARTE 2: USUARIOS, CATÁLOGO, CLIENTES, PROVEEDORES
-- ============================================================================

CREATE TABLE usuarios (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id),
    nombre              TEXT,
    apellido            TEXT,
    email               TEXT,
    dni_cuit            TEXT,
    rol_id              BIGINT NOT NULL REFERENCES roles(id),
    sucursal_id         BIGINT REFERENCES sucursales(id),
    estado_usuario_id   BIGINT NOT NULL REFERENCES estados_usuario(id),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE articulos (
    id                  BIGSERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL,
    nombre_base         TEXT,
    rubro_id            BIGINT REFERENCES rubros(id),       -- nullable
    marca_id            BIGINT REFERENCES marcas(id),       -- nullable
    codigo_interno      TEXT UNIQUE,
    codigo_barra        TEXT UNIQUE,
    sku                 TEXT UNIQUE,
    unidad_medida_id    BIGINT REFERENCES unidades_medida(id),
    costo_sin_iva       NUMERIC(12,2) NOT NULL DEFAULT 0,
    tasa_iva_id         BIGINT NOT NULL REFERENCES tasas_iva(id),
    precio_local        NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio_web          NUMERIC(12,2),
    precio_mayorista    NUMERIC(12,2),
    precio_oferta_web   NUMERIC(12,2),
    disponible_local    BOOLEAN NOT NULL DEFAULT true,
    disponible_web      BOOLEAN NOT NULL DEFAULT true,
    visible_en_tienda   BOOLEAN NOT NULL DEFAULT true,
    id_producto_web     TEXT,
    id_stock_web        TEXT,
    atributo_nombre     TEXT,
    atributo_valor      TEXT,
    peso_kg             NUMERIC(8,3),
    descripcion         TEXT,
    id_migracion        BIGINT,   -- ID original de coverweb para cruce histórico
    activo              BOOLEAN NOT NULL DEFAULT true,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_articulos_default_precio_web()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.precio_web IS NULL THEN NEW.precio_web := NEW.precio_local; END IF;
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articulos_default_precio_web
    BEFORE INSERT OR UPDATE ON articulos
    FOR EACH ROW EXECUTE FUNCTION fn_articulos_default_precio_web();

CREATE TABLE articulo_imagenes (
    id          BIGSERIAL PRIMARY KEY,
    articulo_id BIGINT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    orden       INTEGER NOT NULL DEFAULT 0,
    es_principal BOOLEAN NOT NULL DEFAULT false,
    alt_text    TEXT,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE articulo_precio_sucursal (
    id              BIGSERIAL PRIMARY KEY,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    sucursal_id     BIGINT NOT NULL REFERENCES sucursales(id),
    tipo_precio_id  BIGINT NOT NULL REFERENCES tipos_precio(id),
    precio          NUMERIC(12,2) NOT NULL,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (articulo_id, sucursal_id, tipo_precio_id)
);

CREATE TABLE historico_precios (
    id                BIGSERIAL PRIMARY KEY,
    articulo_id       BIGINT NOT NULL REFERENCES articulos(id),
    fecha             DATE NOT NULL,
    tipo              TEXT NOT NULL,
    costo_sin_iva     NUMERIC(12,2),
    precio_local      NUMERIC(12,2),
    precio_web        NUMERIC(12,2),
    precio_mayorista  NUMERIC(12,2),
    precio_oferta_web NUMERIC(12,2),
    tasa_iva_id       BIGINT REFERENCES tasas_iva(id),
    origen_id         BIGINT,
    usuario_id        UUID REFERENCES usuarios(id),
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clientes (
    id                      BIGSERIAL PRIMARY KEY,
    nombre                  TEXT NOT NULL,
    tipo_cliente_id         BIGINT NOT NULL REFERENCES tipos_cliente(id),
    cuit                    TEXT,
    dni                     TEXT,
    condicion_iva_id        BIGINT REFERENCES condiciones_iva(id),
    domicilio               TEXT,
    localidad_id            BIGINT REFERENCES localidades(id),
    telefono                TEXT,
    email                   TEXT,
    tiene_cuenta_corriente  BOOLEAN NOT NULL DEFAULT false,
    plazo_dias_cta_cte      INTEGER,
    descuento_default_pct   NUMERIC(5,2),
    notas                   TEXT,
    activo                  BOOLEAN NOT NULL DEFAULT true,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proveedores (
    id               BIGSERIAL PRIMARY KEY,
    nombre_comercial TEXT NOT NULL UNIQUE,
    cuit             TEXT,
    razon_social     TEXT,
    domicilio        TEXT,
    cbu_alias        TEXT,
    telefono         TEXT,
    email            TEXT,
    notas            TEXT,
    activo           BOOLEAN NOT NULL DEFAULT true,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deportistas (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    dni         TEXT,
    telefono    TEXT,
    email       TEXT,
    deporte     TEXT,           -- campo legacy texto
    deporte_id  BIGINT REFERENCES deportes(id),  -- FK normalizada
    activo      BOOLEAN NOT NULL DEFAULT true,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sucursales ADD COLUMN responsable_usuario_id UUID REFERENCES usuarios(id);

-- ============================================================================
-- PARTE 3: VENTAS Y COMPROBANTES
-- ============================================================================

CREATE TABLE configuracion_fiscal (
    id               BIGSERIAL PRIMARY KEY,
    cuit             TEXT NOT NULL,
    razon_social     TEXT NOT NULL,
    condicion_iva_id BIGINT NOT NULL REFERENCES condiciones_iva(id),
    actividad_afip   TEXT,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_configuracion_fiscal_singleton ON configuracion_fiscal ((true));

CREATE TABLE numeracion_ventas (
    id              BIGSERIAL PRIMARY KEY,
    ultimo_numero   BIGINT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION obtener_proximo_numero_venta()
RETURNS BIGINT AS $$
DECLARE v_numero BIGINT;
BEGIN
    UPDATE numeracion_ventas SET ultimo_numero = ultimo_numero + 1 RETURNING ultimo_numero INTO v_numero;
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE ventas (
    id              BIGSERIAL PRIMARY KEY,
    numero_venta    BIGINT NOT NULL UNIQUE,
    cliente_id      BIGINT NOT NULL REFERENCES clientes(id),
    sucursal_id     BIGINT NOT NULL REFERENCES sucursales(id),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    estado_venta_id BIGINT NOT NULL REFERENCES estados_venta(id),
    descuento_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones   TEXT,
    fecha_utc       DATE NOT NULL DEFAULT CURRENT_DATE,
    cierre_turno_id BIGINT,   -- FK se agrega después de crear cierres_turno
    mes_contable    DATE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venta_items (
    id              BIGSERIAL PRIMARY KEY,
    venta_id        BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id),
    cantidad        NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    descuento_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(12,2) NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venta_pagos (
    id              BIGSERIAL PRIMARY KEY,
    venta_id        BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    medio_pago_id   BIGINT NOT NULL REFERENCES medios_pago(id),
    emisor_pago_id  BIGINT REFERENCES emisores_pago(id),
    monto           NUMERIC(12,2) NOT NULL,
    referencia      TEXT,
    payment_method_raw TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE numeracion_comprobantes (
    id                      BIGSERIAL PRIMARY KEY,
    punto_venta_id          BIGINT NOT NULL REFERENCES puntos_venta(id),
    tipo_comprobante_id     BIGINT NOT NULL REFERENCES tipos_comprobante(id),
    ultimo_numero           BIGINT NOT NULL DEFAULT 0,
    UNIQUE (punto_venta_id, tipo_comprobante_id)
);

CREATE OR REPLACE FUNCTION obtener_proximo_numero_comprobante(p_punto_venta_id BIGINT, p_tipo_comprobante_id BIGINT)
RETURNS BIGINT AS $$
DECLARE v_numero BIGINT;
BEGIN
    UPDATE numeracion_comprobantes SET ultimo_numero = ultimo_numero + 1
    WHERE punto_venta_id = p_punto_venta_id AND tipo_comprobante_id = p_tipo_comprobante_id
    RETURNING ultimo_numero INTO v_numero;
    IF v_numero IS NULL THEN
        RAISE EXCEPTION 'No existe numeración configurada para punto_venta_id=% y tipo_comprobante_id=%', p_punto_venta_id, p_tipo_comprobante_id;
    END IF;
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE comprobantes (
    id                      BIGSERIAL PRIMARY KEY,
    venta_id                BIGINT NOT NULL UNIQUE REFERENCES ventas(id),
    tipo_comprobante_id     BIGINT NOT NULL REFERENCES tipos_comprobante(id),
    punto_venta_id          BIGINT NOT NULL REFERENCES puntos_venta(id),
    numero                  BIGINT NOT NULL,
    comprobante_asociado_id BIGINT REFERENCES comprobantes(id),
    estado_fiscal_id        BIGINT NOT NULL REFERENCES estados_fiscales(id),
    factura_cae             TEXT,
    factura_cae_vencimiento DATE,
    fecha_emision_utc       TIMESTAMPTZ NOT NULL DEFAULT now(),
    total                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    fiscalizacion_intentos  INTEGER NOT NULL DEFAULT 0,
    impreso_enviado         BOOLEAN NOT NULL DEFAULT false,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (punto_venta_id, tipo_comprobante_id, numero)
);
CREATE UNIQUE INDEX idx_comprobantes_factura_cae_unico ON comprobantes (factura_cae) WHERE factura_cae IS NOT NULL;

CREATE TABLE intentos_fiscalizacion (
    id                   BIGSERIAL PRIMARY KEY,
    comprobante_id       BIGINT NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
    numero_intento       INTEGER NOT NULL,
    fecha_hora_utc       TIMESTAMPTZ NOT NULL DEFAULT now(),
    resultado            TEXT NOT NULL,
    respuesta_cruda_json JSONB,
    mensaje_error        TEXT,
    UNIQUE (comprobante_id, numero_intento)
);

-- ============================================================================
-- PARTE 4: COMPRAS Y STOCK
-- ============================================================================

CREATE TABLE ordenes_compra (
    id                      BIGSERIAL PRIMARY KEY,
    numero_orden            BIGSERIAL,
    proveedor_id            BIGINT NOT NULL REFERENCES proveedores(id),
    sucursal_id             BIGINT NOT NULL REFERENCES sucursales(id),
    deposito_id             BIGINT REFERENCES depositos(id),
    usuario_id              UUID NOT NULL REFERENCES usuarios(id),
    tipo_orden_compra_id    BIGINT NOT NULL REFERENCES tipos_orden_compra(id),
    estado_orden_compra_id  BIGINT NOT NULL REFERENCES estados_orden_compra(id),
    tiene_comprobante       BOOLEAN NOT NULL DEFAULT false,
    numero_factura_proveedor TEXT,
    numero_remito_proveedor  TEXT,
    numero_pedido_externo    TEXT,
    fecha_factura            DATE,
    fecha_remito             DATE,
    fecha_orden              DATE NOT NULL DEFAULT CURRENT_DATE,
    descuento_pct            NUMERIC(5,2) NOT NULL DEFAULT 0,
    flete_monto              NUMERIC(12,2) NOT NULL DEFAULT 0,
    flete_medio_pago_id      BIGINT REFERENCES medios_pago(id),
    flete_transportista_id   BIGINT REFERENCES transportistas(id),
    subtotal                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    total                    NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones            TEXT,
    creado_en                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orden_compra_items (
    id                      BIGSERIAL PRIMARY KEY,
    orden_compra_id         BIGINT NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    articulo_id             BIGINT NOT NULL REFERENCES articulos(id),
    cantidad_facturada      NUMERIC(12,2) NOT NULL,
    cantidad_recibida       NUMERIC(12,2) NOT NULL,
    precio_unitario_sin_iva NUMERIC(12,2) NOT NULL,
    flete_prorrateado       NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_final_unitario    NUMERIC(12,2),
    subtotal                NUMERIC(12,2) NOT NULL,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE movimientos_stock (
    id                          BIGSERIAL PRIMARY KEY,
    sucursal_id                 BIGINT NOT NULL REFERENCES sucursales(id),
    tipo_movimiento_stock_id    BIGINT NOT NULL REFERENCES tipos_movimiento_stock(id),
    subtipo_movimiento_stock_id BIGINT REFERENCES subtipos_movimiento_stock(id),
    deportista_id               BIGINT REFERENCES deportistas(id),
    usuario_id                  UUID REFERENCES usuarios(id),
    -- columnas legacy del SQL 04 original, nullable en producción
    articulo_id                 BIGINT REFERENCES articulos(id),
    estado_movimiento_stock_id  BIGINT REFERENCES estados_movimiento_stock(id),
    cantidad                    NUMERIC(12,2),
    observaciones               TEXT,
    fecha_utc                   DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE movimiento_stock_items (
    id                  BIGSERIAL PRIMARY KEY,
    movimiento_stock_id BIGINT NOT NULL REFERENCES movimientos_stock(id) ON DELETE CASCADE,
    articulo_id         BIGINT NOT NULL REFERENCES articulos(id),
    cantidad            NUMERIC(12,2) NOT NULL,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- PARTE 5: MOVIMIENTOS FINANCIEROS
-- ============================================================================

CREATE TABLE cuentas (
    id                  BIGSERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL UNIQUE,
    cuenta_bancaria_id  BIGINT REFERENCES cuentas_bancarias(id),
    sucursal_id         BIGINT REFERENCES sucursales(id),
    activo              BOOLEAN NOT NULL DEFAULT true,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE movimientos (
    id                  BIGSERIAL PRIMARY KEY,
    sucursal_id         BIGINT NOT NULL REFERENCES sucursales(id),
    cuenta_id           BIGINT REFERENCES cuentas(id),   -- nullable
    categoria_gasto_id  BIGINT REFERENCES categorias_gasto(id),
    concepto_gasto_id   BIGINT REFERENCES conceptos_gasto(id),
    tipo                TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Egreso')),
    monto               NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha_utc           DATE NOT NULL DEFAULT CURRENT_DATE,
    mes_contable        DATE NOT NULL,
    entidad_tipo_id     BIGINT REFERENCES tipos_entidad(id),
    entidad_id          BIGINT,
    origen_tipo         TEXT,
    origen_id           BIGINT,
    estado_cobro_id     BIGINT REFERENCES estados_cobro(id),
    medio_pago_id       BIGINT REFERENCES medios_pago(id),
    turno_id            BIGINT REFERENCES turnos(id),
    usuario_id          UUID REFERENCES usuarios(id),
    observaciones       TEXT,
    anulado             BOOLEAN NOT NULL DEFAULT false,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- PARTE 6: CAJA, SPONSOREO
-- ============================================================================

CREATE TABLE cierres_turno (
    id                      BIGSERIAL PRIMARY KEY,
    sucursal_id             BIGINT NOT NULL REFERENCES sucursales(id),
    turno_id                BIGINT NOT NULL REFERENCES turnos(id),
    usuario_id              UUID NOT NULL REFERENCES usuarios(id),
    estado_cierre_turno_id  BIGINT NOT NULL REFERENCES estados_cierre_turno(id),
    fecha                   DATE NOT NULL DEFAULT CURRENT_DATE,
    apertura                NUMERIC(12,2) NOT NULL DEFAULT 0,
    apertura_contada        NUMERIC(12,2),
    diferencia_apertura     NUMERIC(12,2),
    ingresos_sistema        NUMERIC(12,2) NOT NULL DEFAULT 0,
    egresos_sistema         NUMERIC(12,2) NOT NULL DEFAULT 0,
    resultado_sistema       NUMERIC(12,2) NOT NULL DEFAULT 0,
    efectivo_real           NUMERIC(12,2),
    diferencia              NUMERIC(12,2),
    observaciones           TEXT,
    cerrado_en              TIMESTAMPTZ,
    cantidad_reaperturas    INTEGER NOT NULL DEFAULT 0,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK ventas → cierres_turno (ventas se creó antes)
ALTER TABLE ventas ADD CONSTRAINT fk_ventas_cierre_turno FOREIGN KEY (cierre_turno_id) REFERENCES cierres_turno(id);

CREATE TABLE retiros_caja (
    id              BIGSERIAL PRIMARY KEY,
    sucursal_id     BIGINT REFERENCES sucursales(id),
    cierre_turno_id BIGINT NOT NULL REFERENCES cierres_turno(id),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    concepto        TEXT,
    fecha_utc       DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones   TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reaperturas_caja (
    id               BIGSERIAL PRIMARY KEY,
    cierre_turno_id  BIGINT NOT NULL REFERENCES cierres_turno(id),
    usuario_id       UUID NOT NULL REFERENCES usuarios(id),
    snapshot_antes   JSONB,
    snapshot_despues JSONB,
    motivo           TEXT,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sponsoreos (
    id                  BIGSERIAL PRIMARY KEY,
    deportista_id       BIGINT NOT NULL REFERENCES deportistas(id),
    estado_sponsoreo_id BIGINT NOT NULL REFERENCES estados_sponsoreo(id),
    mes                 INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio                INTEGER NOT NULL CHECK (anio >= 2024),
    costo_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deportista_id, mes, anio)
);

CREATE TABLE sponsoreo_items (
    id              BIGSERIAL PRIMARY KEY,
    sponsoreo_id    BIGINT NOT NULL REFERENCES sponsoreos(id) ON DELETE CASCADE,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id),
    cantidad        NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    costo_unitario  NUMERIC(12,2) NOT NULL,
    subtotal        NUMERIC(12,2) NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- PARTE 7: VISTAS
-- ============================================================================

CREATE VIEW articulos_sin_costo AS
    SELECT
        id, nombre, nombre_base, rubro_id, marca_id,
        codigo_interno, codigo_barra, sku,
        unidad_medida_id, tasa_iva_id,
        precio_local, precio_web, precio_mayorista, precio_oferta_web,
        disponible_local, disponible_web, visible_en_tienda,
        id_producto_web, id_stock_web,
        atributo_nombre, atributo_valor, peso_kg,
        descripcion, id_migracion, activo, creado_en, actualizado_en
    FROM articulos;

-- ============================================================================
-- PARTE 8: FUNCIONES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_rol_usuario()
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT rol_id FROM usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION eliminar_movimiento_stock(p_movimiento_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item        RECORD;
    v_sucursal_id BIGINT;
    v_tipo_id     BIGINT;
BEGIN
    SELECT sucursal_id, tipo_movimiento_stock_id INTO v_sucursal_id, v_tipo_id
    FROM movimientos_stock WHERE id = p_movimiento_id;
    FOR v_item IN SELECT articulo_id, cantidad FROM movimiento_stock_items WHERE movimiento_stock_id = p_movimiento_id LOOP
        IF v_tipo_id = 1 THEN
            UPDATE articulo_stock SET stock_actual = stock_actual - v_item.cantidad WHERE articulo_id = v_item.articulo_id AND sucursal_id = v_sucursal_id;
        ELSIF v_tipo_id = 2 THEN
            UPDATE articulo_stock SET stock_actual = stock_actual + v_item.cantidad WHERE articulo_id = v_item.articulo_id AND sucursal_id = v_sucursal_id;
        END IF;
    END LOOP;
    DELETE FROM movimiento_stock_items WHERE movimiento_stock_id = p_movimiento_id;
    DELETE FROM movimientos_stock WHERE id = p_movimiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION abrir_turno(p_sucursal_id BIGINT, p_turno_id BIGINT, p_usuario_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_apertura  NUMERIC(12,2) := 0;
    v_cierre_id BIGINT;
    v_abierto   BIGINT;
BEGIN
    SELECT id INTO v_abierto FROM cierres_turno WHERE sucursal_id = p_sucursal_id AND estado_cierre_turno_id = 1 LIMIT 1;
    IF v_abierto IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe un turno abierto (id=%). Cerrarlo antes de abrir uno nuevo.', v_abierto;
    END IF;
    SELECT COALESCE(efectivo_real, 0) INTO v_apertura FROM cierres_turno
    WHERE sucursal_id = p_sucursal_id AND estado_cierre_turno_id != 1 ORDER BY fecha DESC, id DESC LIMIT 1;
    v_apertura := COALESCE(v_apertura, 0);
    INSERT INTO cierres_turno (sucursal_id, turno_id, usuario_id, estado_cierre_turno_id, fecha, apertura, ingresos_sistema, egresos_sistema, resultado_sistema, efectivo_real, diferencia)
    VALUES (p_sucursal_id, p_turno_id, p_usuario_id, 1, CURRENT_DATE, v_apertura, 0, 0, v_apertura, 0, 0)
    RETURNING id INTO v_cierre_id;
    RETURN v_cierre_id;
END;
$$;

CREATE OR REPLACE FUNCTION cerrar_turno(p_cierre_id BIGINT, p_efectivo_real NUMERIC, p_observaciones TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_apertura      NUMERIC(12,2);
    v_sucursal_id   BIGINT;
    v_creado_en     TIMESTAMPTZ;
    v_ingresos      NUMERIC(12,2) := 0;
    v_egresos       NUMERIC(12,2) := 0;
    v_retiros       NUMERIC(12,2) := 0;
    v_resultado     NUMERIC(12,2);
    v_diferencia    NUMERIC(12,2);
    v_estado_nuevo  BIGINT;
BEGIN
    SELECT apertura, sucursal_id, creado_en INTO v_apertura, v_sucursal_id, v_creado_en
    FROM cierres_turno WHERE id = p_cierre_id AND estado_cierre_turno_id = 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Turno no encontrado o ya cerrado (id=%).', p_cierre_id; END IF;
    SELECT COALESCE(SUM(vp.monto), 0) INTO v_ingresos FROM ventas v JOIN venta_pagos vp ON vp.venta_id = v.id
    WHERE v.sucursal_id = v_sucursal_id AND vp.medio_pago_id = 1 AND v.creado_en >= v_creado_en AND v.estado_venta_id != 3;
    SELECT COALESCE(SUM(m.monto), 0) INTO v_egresos FROM movimientos m
    WHERE m.sucursal_id = v_sucursal_id AND m.tipo = 'Egreso' AND m.medio_pago_id = 1 AND m.creado_en >= v_creado_en;
    SELECT COALESCE(SUM(rc.monto), 0) INTO v_retiros FROM retiros_caja rc
    WHERE rc.sucursal_id = v_sucursal_id AND rc.creado_en >= v_creado_en;
    v_resultado  := v_apertura + v_ingresos - v_egresos - v_retiros;
    v_diferencia := p_efectivo_real - v_resultado;
    v_estado_nuevo := CASE WHEN ABS(v_diferencia) < 0.01 THEN 2 ELSE 3 END;
    UPDATE cierres_turno SET
        estado_cierre_turno_id = v_estado_nuevo,
        ingresos_sistema       = v_ingresos,
        egresos_sistema        = v_egresos + v_retiros,
        resultado_sistema      = v_resultado,
        efectivo_real          = p_efectivo_real,
        diferencia             = v_diferencia,
        observaciones          = p_observaciones,
        cerrado_en             = now()
    WHERE id = p_cierre_id;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_retiro_caja(p_cierre_turno_id BIGINT, p_monto NUMERIC(12,2), p_usuario_id UUID, p_concepto TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_retiro_id BIGINT;
BEGIN
    INSERT INTO retiros_caja (cierre_turno_id, monto, usuario_id, concepto)
    VALUES (p_cierre_turno_id, p_monto, p_usuario_id, p_concepto)
    RETURNING id INTO v_retiro_id;
    RETURN v_retiro_id;
END;
$$;

-- ============================================================================
-- PARTE 9: RLS EN TODAS LAS TABLAS
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
ALTER TABLE emisores_pago ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE subtipos_movimiento_stock ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE puntos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE deportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulo_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulo_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulo_precio_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE deportistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeracion_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeracion_comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intentos_fiscalizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE retiros_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE reaperturas_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsoreos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsoreo_items ENABLE ROW LEVEL SECURITY;

-- Políticas SELECT para tablas de referencia
CREATE POLICY "select_all" ON paises                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON provincias              FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON localidades             FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON rubros                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON marcas                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON unidades_medida         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON monedas                 FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tasas_iva               FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON condiciones_iva         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_disponibilidad_web FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON medios_pago             FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON emisores_pago           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tarjetas                FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON cuentas_bancarias       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_comprobante       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_fiscales        FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON puntos_venta            FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_venta           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_cobro           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_cliente           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_precio            FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_movimiento_stock  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_movimiento_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON subtipos_movimiento_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON depositos               FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_orden_compra    FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_orden_compra      FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON categorias_gasto        FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON conceptos_gasto         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_entidad           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON organismos              FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON turnos                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_cierre_turno    FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_sponsoreo       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON roles                   FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_usuario         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON sucursales              FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON transportistas          FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON deportes                FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON clientes                FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON proveedores             FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON deportistas             FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON numeracion_ventas       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON numeracion_comprobantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON comprobantes            FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON historico_precios       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON cuentas                 FOR SELECT TO authenticated USING (true);

-- Políticas tablas principales
CREATE POLICY "articulos_select" ON articulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "articulos_insert" ON articulos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "articulos_update" ON articulos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "articulo_stock_select" ON articulo_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "articulo_stock_insert" ON articulo_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "articulo_stock_update" ON articulo_stock FOR UPDATE TO authenticated USING (true);

CREATE POLICY "usuarios_select" ON usuarios FOR SELECT TO authenticated USING (true);

CREATE POLICY "ventas_select" ON ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "ventas_insert" ON ventas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ventas_update" ON ventas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "venta_items_select" ON venta_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "venta_items_insert" ON venta_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "venta_pagos_select" ON venta_pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY "venta_pagos_insert" ON venta_pagos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "movimientos_select" ON movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimientos_insert" ON movimientos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimientos_update" ON movimientos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "movimientos_stock_select" ON movimientos_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimientos_stock_insert" ON movimientos_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimientos_stock_update" ON movimientos_stock FOR UPDATE TO authenticated USING (true);
CREATE POLICY "movimientos_stock_delete" ON movimientos_stock FOR DELETE TO authenticated USING (true);

CREATE POLICY "movimiento_stock_items_select" ON movimiento_stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimiento_stock_items_insert" ON movimiento_stock_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimiento_stock_items_delete" ON movimiento_stock_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "ordenes_compra_select" ON ordenes_compra FOR SELECT TO authenticated USING (true);
CREATE POLICY "ordenes_compra_insert" ON ordenes_compra FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ordenes_compra_update" ON ordenes_compra FOR UPDATE TO authenticated USING (true);

CREATE POLICY "orden_compra_items_select" ON orden_compra_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "orden_compra_items_insert" ON orden_compra_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orden_compra_items_delete" ON orden_compra_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "historico_precios_insert" ON historico_precios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "numeracion_ventas_update"       ON numeracion_ventas       FOR UPDATE TO authenticated USING (true);
CREATE POLICY "numeracion_comprobantes_update" ON numeracion_comprobantes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "comprobantes_insert"            ON comprobantes            FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proveedores_insert"             ON proveedores             FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proveedores_update"             ON proveedores             FOR UPDATE TO authenticated USING (true);

CREATE POLICY "cierres_turno_select" ON cierres_turno FOR SELECT TO authenticated USING (true);
CREATE POLICY "cierres_turno_insert" ON cierres_turno FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cierres_turno_update" ON cierres_turno FOR UPDATE TO authenticated USING (true);

CREATE POLICY "retiros_caja_select" ON retiros_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "retiros_caja_insert" ON retiros_caja FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "reaperturas_caja_select" ON reaperturas_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "reaperturas_caja_insert" ON reaperturas_caja FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- PARTE 10: GRANTS
-- ============================================================================

GRANT SELECT ON paises, provincias, localidades, rubros, marcas, unidades_medida TO authenticated;
GRANT SELECT ON monedas, tasas_iva, condiciones_iva, estados_disponibilidad_web TO authenticated;
GRANT SELECT ON medios_pago, emisores_pago, tarjetas, cuentas_bancarias TO authenticated;
GRANT SELECT ON tipos_comprobante, estados_fiscales, puntos_venta TO authenticated;
GRANT SELECT ON estados_venta, estados_cobro, tipos_cliente, tipos_precio TO authenticated;
GRANT SELECT ON tipos_movimiento_stock, estados_movimiento_stock, subtipos_movimiento_stock TO authenticated;
GRANT SELECT ON depositos, estados_orden_compra, tipos_orden_compra TO authenticated;
GRANT SELECT ON categorias_gasto, conceptos_gasto, tipos_entidad, organismos TO authenticated;
GRANT SELECT ON turnos, estados_cierre_turno, estados_sponsoreo, roles, estados_usuario TO authenticated;
GRANT SELECT ON sucursales, transportistas, deportes TO authenticated;
GRANT SELECT ON clientes, proveedores, deportistas, usuarios TO authenticated;
GRANT SELECT ON numeracion_ventas, numeracion_comprobantes, comprobantes, historico_precios TO authenticated;
GRANT SELECT ON cuentas, articulo_stock TO authenticated;
GRANT SELECT, INSERT, UPDATE ON articulos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ventas TO authenticated;
GRANT SELECT, INSERT ON venta_items, venta_pagos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON movimientos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON movimientos_stock TO authenticated;
GRANT SELECT, INSERT, DELETE ON movimiento_stock_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ordenes_compra TO authenticated;
GRANT SELECT, INSERT, DELETE ON orden_compra_items TO authenticated;
GRANT SELECT, INSERT ON historico_precios TO authenticated;
GRANT SELECT, UPDATE ON numeracion_ventas, numeracion_comprobantes TO authenticated;
GRANT SELECT, INSERT ON comprobantes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON proveedores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cierres_turno TO authenticated;
GRANT SELECT, INSERT ON retiros_caja, reaperturas_caja TO authenticated;
GRANT SELECT ON estados_movimiento_stock TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE movimientos_id_seq            TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE movimientos_stock_id_seq      TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE movimiento_stock_items_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION get_rol_usuario TO authenticated;
GRANT EXECUTE ON FUNCTION eliminar_movimiento_stock TO authenticated;
GRANT EXECUTE ON FUNCTION abrir_turno TO authenticated;
GRANT EXECUTE ON FUNCTION cerrar_turno TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_retiro_caja TO authenticated;

-- ============================================================================
-- PARTE 11: DATOS INICIALES
-- ============================================================================

-- Geografía
INSERT INTO paises (nombre, codigo_iso) VALUES ('Argentina', 'AR');
INSERT INTO provincias (pais_id, nombre) VALUES
    ((SELECT id FROM paises WHERE nombre = 'Argentina'), 'Río Negro'),
    ((SELECT id FROM paises WHERE nombre = 'Argentina'), 'Neuquén');
INSERT INTO localidades (provincia_id, nombre) VALUES
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Cinco Saltos'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Cipolletti'),
    ((SELECT id FROM provincias WHERE nombre = 'Río Negro'), 'Allen'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Neuquén Capital'),
    ((SELECT id FROM provincias WHERE nombre = 'Neuquén'), 'Plottier');

-- Sucursal
INSERT INTO sucursales (nombre, domicilio, localidad_id) VALUES
    ('Cinco Saltos', 'Av. Roca 54, Cinco Saltos, Río Negro',
     (SELECT id FROM localidades WHERE nombre = 'Cinco Saltos'));

-- Puntos de venta
INSERT INTO puntos_venta (sucursal_id, numero, nombre, es_electronico, activo) VALUES
    (1, 3, 'Principal (Electrónico)', true,  true),
    (1, 7, 'PV Enzo (histórico)',     false, false);

-- Depósito
INSERT INTO depositos (id, sucursal_id, nombre, activo) VALUES (1, 1, 'Principal', true);
SELECT setval('depositos_id_seq', 1);

-- Referencia fiscal
INSERT INTO condiciones_iva (nombre) VALUES
    ('Responsable Inscripto'), ('Monotributista'), ('Exento'), ('Consumidor Final'), ('No Responsable');
INSERT INTO configuracion_fiscal (cuit, razon_social, condicion_iva_id, actividad_afip) VALUES
    ('23-23890071-9', 'Vega, Ariel', (SELECT id FROM condiciones_iva WHERE nombre = 'Monotributista'), '476310');

-- Tipos comprobante
INSERT INTO tipos_comprobante (nombre, activo) VALUES
    ('Factura', true), ('Nota Débito', true), ('Nota Crédito', true),
    ('Factura de Crédito Electrónica (MiPyMEs)', false),
    ('Nota de Débito Electrónica (MiPyMEs)', false),
    ('Nota de Crédito Electrónica (MiPyMEs)', false);

-- Estados fiscales
INSERT INTO estados_fiscales (nombre) VALUES
    ('Pendiente'), ('Enviado'), ('CAE_Recibido'), ('CAE_Rechazado'), ('Reintentando'), ('Anulado');

-- Estados de venta (usar IDs fijos para consistencia con el código)
INSERT INTO estados_venta (nombre) VALUES ('Pendiente fiscal'), ('Guardada'), ('Anulada');

-- Tipos y estados
INSERT INTO tipos_cliente (nombre) VALUES ('Consumidor Final'), ('Cuenta Corriente');
INSERT INTO tipos_precio (nombre) VALUES ('Local'), ('Web'), ('Mayorista'), ('Oferta Web');
INSERT INTO tipos_movimiento_stock (id, nombre) VALUES (1,'Ingreso'), (2,'Egreso'), (3,'Transferencia'), (5,'Ajuste');
SELECT setval('tipos_movimiento_stock_id_seq', 5);
INSERT INTO estados_movimiento_stock (nombre) VALUES ('Pendiente'), ('Confirmado');
INSERT INTO estados_orden_compra (nombre) VALUES ('Borrador'), ('Confirmada'), ('Anulada');
INSERT INTO tipos_orden_compra (nombre) VALUES ('Rápida'), ('Completa');
INSERT INTO tipos_entidad (nombre) VALUES ('Cliente'), ('Proveedor'), ('Empleado'), ('Organismo');
INSERT INTO organismos (nombre) VALUES ('AFIP/ARCA'), ('OSECAC'), ('FAECYS'), ('INACAP'), ('Centro Empleados de Comercio');
INSERT INTO turnos (id, nombre) VALUES (1, 'Mañana'), (2, 'Tarde');
SELECT setval('turnos_id_seq', 2);
INSERT INTO estados_cierre_turno (nombre) VALUES ('Abierto'), ('Cerrado sin diferencia'), ('Cerrado con diferencia');
INSERT INTO estados_sponsoreo (nombre) VALUES ('Activo'), ('Cerrado');
INSERT INTO roles (nombre) VALUES ('Admin'), ('Encargado');
INSERT INTO estados_usuario (nombre) VALUES ('Activo'), ('Inactivo');
INSERT INTO monedas (nombre, codigo_iso, simbolo) VALUES ('Peso Argentino', 'ARS', '$');

-- Cliente genérico
INSERT INTO clientes (nombre, tipo_cliente_id, tiene_cuenta_corriente)
VALUES ('Consumidor Final', (SELECT id FROM tipos_cliente WHERE nombre = 'Consumidor Final'), false);

-- Medios de pago (4 genéricos — arquitectura confirmada)
INSERT INTO medios_pago (id, nombre, fiscaliza_por_defecto, activo) VALUES
    (1, 'Efectivo',      false, true),
    (2, 'Débito',        true,  true),
    (3, 'Crédito',       true,  true),
    (4, 'Transferencia', false, true);

-- Emisores de pago
INSERT INTO emisores_pago (id, nombre, fiscaliza, activo) VALUES
    (1, 'Visa',             true,  true),
    (2, 'Mastercard',       true,  true),
    (3, 'Naranja',          true,  true),
    (4, 'Naranja X',        true,  true),
    (5, 'Cabal',            true,  true),
    (6, 'American Express', true,  true),
    (7, 'Mercado Pago',     true,  true),
    (8, 'Patagonia',        false, true),
    (9, 'OpenPay',          true,  true);
SELECT setval('emisores_pago_id_seq', 9);

-- Cuentas bancarias
INSERT INTO cuentas_bancarias (nombre, alias) VALUES
    ('Mercado Pago EAV',  'habitus.sd'),
    ('Patagonia EAV',     'habitus.patagonia'),
    ('Camino Doce Doce',  'camino.doce.doce');

-- Cuentas contables
INSERT INTO cuentas (nombre, sucursal_id) VALUES ('Caja Efectivo', 1);
INSERT INTO cuentas (nombre, cuenta_bancaria_id) VALUES
    ('Mercado Pago EAV', (SELECT id FROM cuentas_bancarias WHERE nombre = 'Mercado Pago EAV')),
    ('Patagonia EAV',    (SELECT id FROM cuentas_bancarias WHERE nombre = 'Patagonia EAV')),
    ('Camino Doce Doce', (SELECT id FROM cuentas_bancarias WHERE nombre = 'Camino Doce Doce'));

-- Tasas IVA
INSERT INTO tasas_iva (id, nombre, porcentaje, activo) VALUES
    (4, '21%',   21.00, true),
    (5, '10.5%', 10.50, true),
    (6, '0%',     0.00, true);
SELECT setval('tasas_iva_id_seq', 6);

-- Unidades de medida
INSERT INTO unidades_medida (id, nombre, abreviatura) VALUES
    (4, 'Unidad', 'u'), (5, 'Pack', 'pk'), (6, 'Caja', 'cj');
SELECT setval('unidades_medida_id_seq', 6);

-- Rubros
INSERT INTO rubros (id, nombre, activo) VALUES
    (1,'Proteínas',true),(2,'Creatinas',true),(3,'Barras de proteína',true),
    (4,'Colágenos',true),(5,'Pre-entrenamiento',true),(6,'Aminoácidos',true),
    (7,'Quemadores',true),(8,'Salud y bienestar',true),(9,'Geles',true),
    (10,'Bebidas Isotónicas',true),(11,'Glutamina',true),(12,'Multivitamínicos',true),
    (13,'Óxido Nítrico',true),(14,'Pro Hormonal',true),(15,'Energía',true),
    (16,'Ganadores de peso',true),(17,'Sales',true),(18,'Foods',true),
    (19,'Proteínas Vegetales',true),(22,'Geles Cafeina',true),(23,'Shakers',true);
SELECT setval('rubros_id_seq', 23);

-- Marcas
INSERT INTO marcas (id, nombre, activo) VALUES
    (1,'ENA',true),(2,'Star Nutrition',true),(3,'Gold Nutrition',true),
    (4,'Nutremax',true),(5,'Gentech',true),(6,'One Fit',true),
    (7,'Innovanaturals',true),(8,'Vita Tech',true),(9,'Body Advance',true),
    (10,'Ultra Tech',true),(11,'Xtrenght',true),(12,'Pulver',true),
    (13,'Mervick',true),(14,'GU Energy',true),(15,'Neix Reloaded',true),
    (16,'Optimum Nutrition',true),(18,'Universal Nutrition',true),
    (20,'BSN',false),(21,'Age Biologique',false),(22,'Bad Monkey',false),
    (23,'Everlast',true),(24,'Flip',true),(25,'Generation Fit',false),
    (26,'Geonat',false),(27,'Granger',true),(28,'Hoch Sport',true),
    (29,'HTN',false),(30,'King',false),(31,'Laddubar',false),
    (32,'Mrs Taste',true),(33,'Muecas',false),(34,'New Protein',false),
    (35,'NF Nutrition',false),(36,'Not Co',false),(37,'Nutrex',false),
    (38,'Nutrilab',false),(39,'Núcleo Fit',false),(40,'Pont',true),
    (41,'Victory Endurance',false);
SELECT setval('marcas_id_seq', 41);

-- Proveedores
INSERT INTO proveedores (id, nombre_comercial, activo) VALUES
    (1,'Black Suplementos',true),(2,'Disfit',true),(3,'EPN',true),(4,'Vitatech',true);
SELECT setval('proveedores_id_seq', 4);

-- Transportistas
INSERT INTO transportistas (id, nombre, activo) VALUES
    (1,'Andreani',true),(2,'Correo Argentino',true),(3,'VIA CARGO',true);
SELECT setval('transportistas_id_seq', 3);

-- Categorías de gasto
INSERT INTO categorias_gasto (id, nombre, tipo) VALUES
    (1,'Compras Mercadería','Egreso'),(2,'Empleados','Egreso'),
    (3,'Impuestos','Egreso'),(4,'Local Comercial','Egreso'),
    (5,'Marketing','Egreso'),(6,'Página Web','Egreso'),
    (7,'Servicios','Egreso'),(8,'Sistema','Egreso'),
    (9,'Team Habitus','Egreso'),(10,'Ventas','Sistema'),
    (11,'Otros Ingresos','Ingreso'),(13,'Caja','Ambos');
SELECT setval('categorias_gasto_id_seq', 13);

-- Conceptos de gasto
INSERT INTO conceptos_gasto (id, categoria_gasto_id, nombre, tipo) VALUES
    (1,4,'Alquiler','Egreso'),(4,7,'Agua','Egreso'),
    (5,2,'Sueldo','Egreso'),(11,2,'Adelanto sueldo','Egreso'),
    (12,2,'F931','Egreso'),(13,2,'OSECAC','Egreso'),
    (14,2,'FAECYS','Egreso'),(15,2,'INACAP','Egreso'),
    (16,2,'Sindicato','Egreso'),(17,2,'Limpieza','Egreso'),
    (18,3,'Ingresos Brutos','Egreso'),(19,3,'Municipalidad','Egreso'),
    (20,3,'AFIP Monotributo','Egreso'),(21,4,'Mantenimiento','Egreso'),
    (22,5,'Publicidad Instagram','Egreso'),(23,5,'Diseño','Egreso'),
    (24,6,'Empretienda','Egreso'),(25,6,'GoDaddy','Egreso'),
    (26,6,'Canva','Egreso'),(27,7,'Luz EDERSA','Egreso'),
    (28,7,'Gas Camuzzi','Egreso'),(29,7,'Internet','Egreso'),
    (30,7,'Claro celular','Egreso'),(31,8,'Coverweb','Egreso'),
    (32,8,'Otro sistema','Egreso'),(33,1,'Compra mercadería','Egreso'),
    (34,9,'Sponsoreo suplementos','Egreso'),(35,10,'Venta local','Sistema'),
    (41,13,'Retiro','Egreso'),(43,13,'Ingreso','Ingreso'),
    (44,1,'Flete compra','Egreso');
SELECT setval('conceptos_gasto_id_seq', 44);

-- Subtipos movimiento stock
INSERT INTO subtipos_movimiento_stock (id, tipo_movimiento_stock_id, nombre, activo) VALUES
    (1,2,'Consumo interno',true),(2,2,'Merma',true),(3,2,'Sponsoreo',true);
SELECT setval('subtipos_movimiento_stock_id_seq', 3);

-- Deportes
INSERT INTO deportes (id, nombre, activo) VALUES
    (1,'MMA',true),(2,'Judo',true),(3,'Jiu-Jitsu',true),
    (4,'Trail Running',true),(5,'Running',true),(6,'Para-atletismo',true);
SELECT setval('deportes_id_seq', 6);

-- Deportistas
INSERT INTO deportistas (id, nombre, apellido, deporte_id, activo) VALUES
    (1,'Facundo','Robles',1,true),(2,'Hernán','Urra',6,true),
    (3,'Isaac','Domínguez',4,true),(4,'Juan','Paniccia',2,true),
    (5,'Iara','Figueroa',2,true),(6,'Joaquín','Burgos',3,true),
    (7,'Carla','Pavéz',3,true),(8,'Roque','Benegas',5,true);
SELECT setval('deportistas_id_seq', 8);

-- Numeración (ajustar al día del corte con valores reales de coverweb)
INSERT INTO numeracion_ventas (ultimo_numero) VALUES (1309);
INSERT INTO numeracion_comprobantes (punto_venta_id, tipo_comprobante_id, ultimo_numero)
VALUES (1, 1, 386);

-- ============================================================================
-- FIN
-- ============================================================================
