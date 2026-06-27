-- ============================================================================
-- HABITUS SD — Archivo 09: PARCHES PARA PRODUCCIÓN
-- ============================================================================
-- Ejecutar DESPUÉS de 01 al 08 + fix_retiro.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLAS NUEVAS (primero, antes de cualquier ALTER que las referencie)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subtipos_movimiento_stock (
    id                       BIGSERIAL PRIMARY KEY,
    tipo_movimiento_stock_id BIGINT NOT NULL REFERENCES tipos_movimiento_stock(id),
    nombre                   TEXT NOT NULL,
    activo                   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS transportistas (
    id        BIGSERIAL PRIMARY KEY,
    nombre    TEXT NOT NULL,
    activo    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS emisores_pago (
    id        BIGSERIAL PRIMARY KEY,
    nombre    TEXT NOT NULL,
    fiscaliza BOOLEAN NOT NULL DEFAULT false,
    activo    BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
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
    id              BIGSERIAL PRIMARY KEY,
    cierre_turno_id BIGINT NOT NULL REFERENCES cierres_turno(id),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    snapshot_antes  JSONB,
    snapshot_despues JSONB,
    motivo          TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- usuarios: nombre + apellido separados (el SQL 02 creó nombre_completo)
ALTER TABLE usuarios
    DROP COLUMN IF EXISTS nombre_completo;
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS nombre   TEXT,
    ADD COLUMN IF NOT EXISTS apellido TEXT;

-- ventas: fecha_utc DATE + cierre_turno_id + mes_contable
ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS cierre_turno_id BIGINT REFERENCES cierres_turno(id),
    ADD COLUMN IF NOT EXISTS mes_contable    DATE;

-- movimientos: anulado + cuenta_id nullable
ALTER TABLE movimientos
    ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE movimientos
    ALTER COLUMN cuenta_id DROP NOT NULL;

-- movimientos_stock: limpiar columnas del SQL 04 que no se usan
-- y agregar las que sí se usan
ALTER TABLE movimientos_stock
    DROP COLUMN IF EXISTS articulo_id,
    DROP COLUMN IF EXISTS cantidad,
    DROP COLUMN IF EXISTS estado_movimiento_stock_id,
    DROP COLUMN IF EXISTS sucursal_destino_id,
    DROP COLUMN IF EXISTS origen_tipo,
    DROP COLUMN IF EXISTS origen_id;
ALTER TABLE movimientos_stock
    ADD COLUMN IF NOT EXISTS subtipo_movimiento_stock_id BIGINT REFERENCES subtipos_movimiento_stock(id),
    ADD COLUMN IF NOT EXISTS deportista_id               BIGINT REFERENCES deportistas(id);

-- retiros_caja: fecha_utc DATE
ALTER TABLE retiros_caja
    ADD COLUMN IF NOT EXISTS fecha_utc DATE NOT NULL DEFAULT CURRENT_DATE;

-- ordenes_compra: flete_transportista_id
ALTER TABLE ordenes_compra
    ADD COLUMN IF NOT EXISTS flete_transportista_id BIGINT REFERENCES transportistas(id);

-- cierres_turno: campos adicionales
ALTER TABLE cierres_turno
    ADD COLUMN IF NOT EXISTS apertura_contada     NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS diferencia_apertura  NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS cantidad_reaperturas INTEGER NOT NULL DEFAULT 0;

-- venta_pagos: emisor_pago_id
ALTER TABLE venta_pagos
    ADD COLUMN IF NOT EXISTS emisor_pago_id BIGINT REFERENCES emisores_pago(id);

-- ---------------------------------------------------------------------------
-- 3. RLS EN TABLAS NUEVAS
-- ---------------------------------------------------------------------------

ALTER TABLE subtipos_movimiento_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportistas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE emisores_pago             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reaperturas_caja          ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_stock_items    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subtipos_movimiento_stock_select" ON subtipos_movimiento_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "transportistas_select"            ON transportistas            FOR SELECT TO authenticated USING (true);
CREATE POLICY "transportistas_insert"            ON transportistas            FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "emisores_pago_select"             ON emisores_pago             FOR SELECT TO authenticated USING (true);
CREATE POLICY "historico_precios_select"         ON historico_precios         FOR SELECT TO authenticated USING (true);
CREATE POLICY "historico_precios_insert"         ON historico_precios         FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reaperturas_caja_select"          ON reaperturas_caja          FOR SELECT TO authenticated USING (true);
CREATE POLICY "reaperturas_caja_insert"          ON reaperturas_caja          FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimiento_stock_items_select"    ON movimiento_stock_items    FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimiento_stock_items_insert"    ON movimiento_stock_items    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "movimiento_stock_items_delete"    ON movimiento_stock_items    FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. RLS EN TABLAS EXISTENTES (políticas faltantes)
-- ---------------------------------------------------------------------------

ALTER TABLE articulo_stock      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_compra      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_compra_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articulo_stock_select"     ON articulo_stock;
DROP POLICY IF EXISTS "articulo_stock_insert"     ON articulo_stock;
DROP POLICY IF EXISTS "articulo_stock_update"     ON articulo_stock;
DROP POLICY IF EXISTS "ordenes_compra_select"     ON ordenes_compra;
DROP POLICY IF EXISTS "ordenes_compra_insert"     ON ordenes_compra;
DROP POLICY IF EXISTS "ordenes_compra_update"     ON ordenes_compra;
DROP POLICY IF EXISTS "orden_compra_items_select" ON orden_compra_items;
DROP POLICY IF EXISTS "orden_compra_items_insert" ON orden_compra_items;
DROP POLICY IF EXISTS "orden_compra_items_delete" ON orden_compra_items;

CREATE POLICY "articulo_stock_select"     ON articulo_stock      FOR SELECT TO authenticated USING (true);
CREATE POLICY "articulo_stock_insert"     ON articulo_stock      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "articulo_stock_update"     ON articulo_stock      FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ordenes_compra_select"     ON ordenes_compra      FOR SELECT TO authenticated USING (true);
CREATE POLICY "ordenes_compra_insert"     ON ordenes_compra      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ordenes_compra_update"     ON ordenes_compra      FOR UPDATE TO authenticated USING (true);
CREATE POLICY "orden_compra_items_select" ON orden_compra_items  FOR SELECT TO authenticated USING (true);
CREATE POLICY "orden_compra_items_insert" ON orden_compra_items  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orden_compra_items_delete" ON orden_compra_items  FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5. VISTA articulos_sin_costo
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS articulos_sin_costo;
CREATE VIEW articulos_sin_costo AS
    SELECT
        id, nombre, nombre_base, rubro_id, marca_id,
        codigo_interno, codigo_barra, sku,
        tasa_iva_id,
        precio_local, precio_web, precio_mayorista, precio_oferta_web,
        disponible_local, disponible_web, visible_en_tienda,
        id_producto_web, id_stock_web,
        atributo_nombre, atributo_valor, peso_kg,
        descripcion, activo, creado_en, actualizado_en
    FROM articulos;

-- ---------------------------------------------------------------------------
-- 6. FUNCIONES
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_rol_usuario()
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT rol_id FROM usuarios WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION get_rol_usuario TO authenticated;

CREATE OR REPLACE FUNCTION eliminar_movimiento_stock(p_movimiento_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item        RECORD;
    v_sucursal_id BIGINT;
    v_tipo_id     BIGINT;
BEGIN
    SELECT sucursal_id, tipo_movimiento_stock_id
    INTO v_sucursal_id, v_tipo_id
    FROM movimientos_stock WHERE id = p_movimiento_id;

    FOR v_item IN
        SELECT articulo_id, cantidad FROM movimiento_stock_items
        WHERE movimiento_stock_id = p_movimiento_id
    LOOP
        IF v_tipo_id = 1 THEN
            UPDATE articulo_stock SET stock_actual = stock_actual - v_item.cantidad
            WHERE articulo_id = v_item.articulo_id AND sucursal_id = v_sucursal_id;
        ELSIF v_tipo_id = 2 THEN
            UPDATE articulo_stock SET stock_actual = stock_actual + v_item.cantidad
            WHERE articulo_id = v_item.articulo_id AND sucursal_id = v_sucursal_id;
        END IF;
    END LOOP;

    DELETE FROM movimiento_stock_items WHERE movimiento_stock_id = p_movimiento_id;
    DELETE FROM movimientos_stock WHERE id = p_movimiento_id;
END;
$$;
GRANT EXECUTE ON FUNCTION eliminar_movimiento_stock TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. DATOS DE REFERENCIA
-- ---------------------------------------------------------------------------

INSERT INTO medios_pago (id, nombre, fiscaliza_por_defecto, activo) VALUES
    (1, 'Efectivo',      false, true),
    (2, 'Débito',        true,  true),
    (3, 'Crédito',       true,  true),
    (4, 'Transferencia', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO transportistas (nombre) VALUES
    ('Andreani'), ('Correo Argentino'), ('VIA CARGO')
ON CONFLICT DO NOTHING;

INSERT INTO turnos (id, nombre) VALUES (1, 'Mañana'), (2, 'Tarde')
ON CONFLICT (id) DO NOTHING;

INSERT INTO conceptos_gasto (id, categoria_gasto_id, nombre, tipo)
VALUES (44, 1, 'Flete compra', 'Egreso')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. SECUENCIAS — AJUSTAR CON VALORES REALES DE COVERWEB ANTES DE EJECUTAR
-- ---------------------------------------------------------------------------

UPDATE numeracion_ventas SET ultimo_numero = 1293;
UPDATE numeracion_comprobantes SET ultimo_numero = 360
WHERE punto_venta_id  = (SELECT id FROM puntos_venta WHERE numero = 3)
  AND tipo_comprobante_id = (SELECT id FROM tipos_comprobante WHERE nombre = 'Factura');

-- ============================================================================
-- FIN DEL ARCHIVO 09
-- ============================================================================
