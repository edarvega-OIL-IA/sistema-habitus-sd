-- ============================================================
-- 10_produccion_fix_esquema.sql
-- Ejecutar en: habitus-sd-production (Supabase SQL Editor)
-- ============================================================

-- 1. movimientos.anulado
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT false;

-- 2. ordenes_compra.flete_transportista_id
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS flete_transportista_id BIGINT NULL REFERENCES transportistas(id);

-- 3. articulos.unidad_medida_id
ALTER TABLE articulos ADD COLUMN IF NOT EXISTS unidad_medida_id BIGINT NULL REFERENCES unidades_medida(id);

-- 4. RLS artículos
ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articulos_select" ON articulos;
CREATE POLICY "articulos_select" ON articulos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "articulos_insert" ON articulos;
CREATE POLICY "articulos_insert" ON articulos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "articulos_update" ON articulos;
CREATE POLICY "articulos_update" ON articulos
  FOR UPDATE TO authenticated USING (true);

-- 5. Vista articulos_sin_costo
DROP VIEW IF EXISTS articulos_sin_costo;
CREATE VIEW articulos_sin_costo AS
  SELECT
    id, nombre, nombre_base, rubro_id, marca_id,
    codigo_interno, codigo_barra, sku,
    unidad_medida_id, tasa_iva_id,
    precio_local, precio_web, precio_mayorista, precio_oferta_web,
    disponible_local, disponible_web, visible_en_tienda,
    atributo_nombre, atributo_valor, peso_kg, descripcion,
    id_producto_web, id_stock_web, activo, creado_en, actualizado_en
  FROM articulos;

-- 6. Verificación
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name='movimientos' AND column_name='anulado') AS movimientos_anulado_ok,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name='ordenes_compra' AND column_name='flete_transportista_id') AS ordenes_flete_ok,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name='articulos' AND column_name='unidad_medida_id') AS articulos_unidad_ok,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename='articulos') AS articulos_policies_count;
