-- ============================================================================
-- HABITUS SD — Archivo 11: TABLAS FALTANTES + RLS COMPLETO EN PRODUCCIÓN
-- ============================================================================
-- Ejecutar en: habitus-sd-production (Supabase SQL Editor)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLAS FALTANTES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subtipos_movimiento_stock (
    id                       BIGSERIAL PRIMARY KEY,
    tipo_movimiento_stock_id BIGINT NOT NULL REFERENCES tipos_movimiento_stock(id),
    nombre                   TEXT NOT NULL,
    activo                   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS historico_precios (
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

CREATE TABLE IF NOT EXISTS reaperturas_caja (
    id               BIGSERIAL PRIMARY KEY,
    cierre_turno_id  BIGINT NOT NULL REFERENCES cierres_turno(id),
    usuario_id       UUID NOT NULL REFERENCES usuarios(id),
    snapshot_antes   JSONB,
    snapshot_despues JSONB,
    motivo           TEXT,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimiento_stock_items (
    id                  BIGSERIAL PRIMARY KEY,
    movimiento_stock_id BIGINT NOT NULL REFERENCES movimientos_stock(id) ON DELETE CASCADE,
    articulo_id         BIGINT NOT NULL REFERENCES articulos(id),
    cantidad            NUMERIC(12,2) NOT NULL,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. COLUMNAS FALTANTES EN TABLAS EXISTENTES
-- ---------------------------------------------------------------------------

ALTER TABLE cierres_turno ADD COLUMN IF NOT EXISTS cerrado_en TIMESTAMPTZ;
ALTER TABLE cierres_turno ADD COLUMN IF NOT EXISTS cantidad_reaperturas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE retiros_caja ADD COLUMN IF NOT EXISTS sucursal_id BIGINT REFERENCES sucursales(id);
ALTER TABLE movimientos_stock ADD COLUMN IF NOT EXISTS subtipo_movimiento_stock_id BIGINT REFERENCES subtipos_movimiento_stock(id);
ALTER TABLE movimientos_stock ADD COLUMN IF NOT EXISTS deportista_id BIGINT REFERENCES deportistas(id);

-- ---------------------------------------------------------------------------
-- 3. RLS — TABLAS NUEVAS
-- ---------------------------------------------------------------------------

ALTER TABLE subtipos_movimiento_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reaperturas_caja          ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_stock_items    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all" ON subtipos_movimiento_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON historico_precios         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON reaperturas_caja          FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON movimiento_stock_items    FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_all" ON historico_precios      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "insert_all" ON reaperturas_caja       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "insert_all" ON movimiento_stock_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_all" ON movimiento_stock_items FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. RLS — TABLAS PRINCIPALES
-- ---------------------------------------------------------------------------

ALTER TABLE ventas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_pagos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ventas_select"            ON ventas;
DROP POLICY IF EXISTS "ventas_insert"            ON ventas;
DROP POLICY IF EXISTS "ventas_update"            ON ventas;
DROP POLICY IF EXISTS "venta_items_select"       ON venta_items;
DROP POLICY IF EXISTS "venta_items_insert"       ON venta_items;
DROP POLICY IF EXISTS "venta_pagos_select"       ON venta_pagos;
DROP POLICY IF EXISTS "venta_pagos_insert"       ON venta_pagos;
DROP POLICY IF EXISTS "movimientos_select"       ON movimientos;
DROP POLICY IF EXISTS "movimientos_insert"       ON movimientos;
DROP POLICY IF EXISTS "movimientos_update"       ON movimientos;
DROP POLICY IF EXISTS "movimientos_stock_select" ON movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_insert" ON movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_update" ON movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_delete" ON movimientos_stock;
DROP POLICY IF EXISTS "usuarios_select"          ON usuarios;
DROP POLICY IF EXISTS "turnos_select"            ON turnos;

CREATE POLICY "ventas_select"            ON ventas            FOR SELECT TO authenticated USING (true);
CREATE POLICY "ventas_insert"            ON ventas            FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ventas_update"            ON ventas            FOR UPDATE TO authenticated USING (true);
CREATE POLICY "venta_items_select"       ON venta_items       FOR SELECT TO authenticated USING (true);
CREATE POLICY "venta_items_insert"       ON venta_items       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "venta_pagos_select"       ON venta_pagos       FOR SELECT TO authenticated USING (true);
CREATE POLICY "venta_pagos_insert"       ON venta_pagos       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimientos_select"       ON movimientos       FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimientos_insert"       ON movimientos       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimientos_update"       ON movimientos       FOR UPDATE TO authenticated USING (true);
CREATE POLICY "movimientos_stock_select" ON movimientos_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimientos_stock_insert" ON movimientos_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimientos_stock_update" ON movimientos_stock FOR UPDATE TO authenticated USING (true);
CREATE POLICY "movimientos_stock_delete" ON movimientos_stock FOR DELETE TO authenticated USING (true);
CREATE POLICY "usuarios_select"          ON usuarios          FOR SELECT TO authenticated USING (true);
CREATE POLICY "turnos_select"            ON turnos            FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5. RLS — TABLAS DE REFERENCIA
-- ---------------------------------------------------------------------------

ALTER TABLE marcas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubros                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasas_iva               ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_medida         ENABLE ROW LEVEL SECURITY;
ALTER TABLE medios_pago             ENABLE ROW LEVEL SECURITY;
ALTER TABLE emisores_pago           ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_venta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_orden_compra    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_orden_compra      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_movimiento_stock  ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_gasto        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conceptos_gasto         ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_venta            ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeracion_ventas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeracion_comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_comprobante       ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_cierre_turno    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all" ON marcas;
DROP POLICY IF EXISTS "select_all" ON rubros;
DROP POLICY IF EXISTS "select_all" ON tasas_iva;
DROP POLICY IF EXISTS "select_all" ON unidades_medida;
DROP POLICY IF EXISTS "select_all" ON medios_pago;
DROP POLICY IF EXISTS "select_all" ON emisores_pago;
DROP POLICY IF EXISTS "select_all" ON estados_venta;
DROP POLICY IF EXISTS "select_all" ON estados_orden_compra;
DROP POLICY IF EXISTS "select_all" ON tipos_orden_compra;
DROP POLICY IF EXISTS "select_all" ON tipos_movimiento_stock;
DROP POLICY IF EXISTS "select_all" ON categorias_gasto;
DROP POLICY IF EXISTS "select_all" ON conceptos_gasto;
DROP POLICY IF EXISTS "select_all" ON proveedores;
DROP POLICY IF EXISTS "select_all" ON sucursales;
DROP POLICY IF EXISTS "select_all" ON roles;
DROP POLICY IF EXISTS "select_all" ON puntos_venta;
DROP POLICY IF EXISTS "select_all" ON depositos;
DROP POLICY IF EXISTS "select_all" ON comprobantes;
DROP POLICY IF EXISTS "select_all" ON numeracion_ventas;
DROP POLICY IF EXISTS "select_all" ON numeracion_comprobantes;
DROP POLICY IF EXISTS "select_all" ON clientes;
DROP POLICY IF EXISTS "select_all" ON tipos_comprobante;
DROP POLICY IF EXISTS "select_all" ON estados_cierre_turno;

CREATE POLICY "select_all" ON marcas                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON rubros                  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tasas_iva               FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON unidades_medida         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON medios_pago             FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON emisores_pago           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_venta           FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_orden_compra    FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_orden_compra      FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_movimiento_stock  FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON categorias_gasto        FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON conceptos_gasto         FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON proveedores             FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON sucursales              FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON roles                   FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON puntos_venta            FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON depositos               FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON comprobantes            FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON numeracion_ventas       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON numeracion_comprobantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON clientes                FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON tipos_comprobante       FOR SELECT TO authenticated USING (true);
CREATE POLICY "select_all" ON estados_cierre_turno    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "numeracion_ventas_update"       ON numeracion_ventas;
DROP POLICY IF EXISTS "numeracion_comprobantes_update" ON numeracion_comprobantes;
DROP POLICY IF EXISTS "comprobantes_insert"            ON comprobantes;
DROP POLICY IF EXISTS "proveedores_insert"             ON proveedores;
DROP POLICY IF EXISTS "proveedores_update"             ON proveedores;

CREATE POLICY "numeracion_ventas_update"       ON numeracion_ventas       FOR UPDATE TO authenticated USING (true);
CREATE POLICY "numeracion_comprobantes_update" ON numeracion_comprobantes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "comprobantes_insert"            ON comprobantes            FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proveedores_insert"             ON proveedores             FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "proveedores_update"             ON proveedores             FOR UPDATE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 6. VERIFICACIÓN FINAL
-- ---------------------------------------------------------------------------

SELECT tablename, COUNT(*) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
