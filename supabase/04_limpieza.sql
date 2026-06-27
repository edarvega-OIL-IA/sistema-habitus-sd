-- ============================================================================
-- HABITUS SD — Limpieza del archivo 04 (ejecutar SOLO si necesitás re-correr
-- 04_compras_proveedores.sql desde cero, por ejemplo tras una ejecución parcial)
-- ============================================================================
-- ADVERTENCIA: esto elimina permanentemente las tablas, funciones y trigger
-- del módulo de compras y movimientos de stock. No toca nada de los archivos
-- 01, 01b, 02 ni 03. Ejecutar ÚNICAMENTE en sandbox, nunca en producción
-- salvo que estés 100% seguro de que no hay datos reales.
-- ============================================================================

-- Trigger y funciones primero (no tienen dependencias de otros objetos)
DROP TRIGGER IF EXISTS trg_aplicar_movimiento_stock_confirmado ON movimientos_stock;
DROP FUNCTION IF EXISTS fn_aplicar_movimiento_stock_confirmado();
DROP FUNCTION IF EXISTS redistribuir_flete_orden_compra(BIGINT);

-- Tablas en orden inverso de dependencias
DROP TABLE IF EXISTS movimientos_stock CASCADE;
DROP TABLE IF EXISTS orden_compra_items CASCADE;
DROP TABLE IF EXISTS ordenes_compra CASCADE;

-- ============================================================================
-- Listo. Ahora podés ejecutar 04_compras_proveedores.sql limpio.
-- ============================================================================
