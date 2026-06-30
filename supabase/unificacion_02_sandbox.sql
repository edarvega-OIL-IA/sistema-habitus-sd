-- ============================================================
-- UNIFICACIÓN PRODUCCIÓN → SANDBOX
-- Sistema Habitus SD — Sesión 14 (30/06/2026)
-- Ejecutar en SANDBOX únicamente
-- ============================================================

-- ----------------------------------------------------------
-- 1. medios_pago: agregar QR Mercado Pago (id=5 en producción)
--    Se fuerza el id explícito para que coincida en ambos ambientes
--    y evitar que venta_pagos.medio_pago_id quede desalineado al
--    migrar datos entre entornos en el futuro.
-- ----------------------------------------------------------

INSERT INTO medios_pago (id, nombre, fiscaliza_por_defecto, activo)
VALUES (5, 'QR Mercado Pago', true, true)
ON CONFLICT (id) DO NOTHING;

-- Si la secuencia de medios_pago quedó por debajo de 5, realinearla
SELECT setval(
  pg_get_serial_sequence('medios_pago', 'id'),
  GREATEST((SELECT MAX(id) FROM medios_pago), 5)
);

-- ----------------------------------------------------------
-- 2. estados_venta: agregar Fiscalizada (id=4 en producción)
-- ----------------------------------------------------------

INSERT INTO estados_venta (id, nombre)
VALUES (4, 'Fiscalizada')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('estados_venta', 'id'),
  GREATEST((SELECT MAX(id) FROM estados_venta), 4)
);

-- ----------------------------------------------------------
-- 3. ventas: agregar columna mes_contable (existe en producción)
-- ----------------------------------------------------------

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS mes_contable DATE;

-- Completar retroactivamente para las ventas ya cargadas en sandbox
UPDATE ventas
SET mes_contable = date_trunc('month', fecha_utc)::date
WHERE mes_contable IS NULL;

-- ============================================================
-- VERIFICACIÓN — correr después de aplicar lo anterior
-- ============================================================

-- Debe devolver 5 filas, con id=5 → QR Mercado Pago
-- SELECT id, nombre FROM medios_pago ORDER BY id;

-- Debe devolver 4 filas, con id=4 → Fiscalizada
-- SELECT id, nombre FROM estados_venta ORDER BY id;

-- mes_contable no debe tener nulls
-- SELECT COUNT(*) FROM ventas WHERE mes_contable IS NULL;

-- ============================================================
-- FIN
-- ============================================================
