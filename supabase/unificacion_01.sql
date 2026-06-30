-- ============================================================
-- UNIFICACIÓN SANDBOX → PRODUCCIÓN
-- Sistema Habitus SD — Sesión 14 (30/06/2026)
-- Ejecutar en PRODUCCIÓN únicamente
-- ============================================================

-- ----------------------------------------------------------
-- 1. Agregar columna mes_contable a ventas (existe en producción, falta en sandbox)
--    NOTA: esto es al revés — sandbox es quien necesita la columna.
--    Ejecutar en SANDBOX, no en producción:
--
--    ALTER TABLE ventas ADD COLUMN mes_contable DATE;
--    UPDATE ventas SET mes_contable = date_trunc('month', fecha_utc)::date WHERE mes_contable IS NULL;
-- ----------------------------------------------------------

-- ----------------------------------------------------------
-- 2. Funciones faltantes en PRODUCCIÓN (copiadas tal cual de sandbox)
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_aplicar_item_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_tipo_nombre TEXT;
    v_sucursal_id BIGINT;
    v_signo INTEGER;
BEGIN
    SELECT tms.nombre, ms.sucursal_id
    INTO v_tipo_nombre, v_sucursal_id
    FROM movimientos_stock ms
    JOIN tipos_movimiento_stock tms ON tms.id = ms.tipo_movimiento_stock_id
    WHERE ms.id = NEW.movimiento_stock_id;
    v_signo := CASE WHEN v_tipo_nombre = 'Egreso' THEN -1 ELSE 1 END;
    UPDATE articulo_stock
    SET stock_actual = stock_actual + (v_signo * NEW.cantidad),
        actualizado_en = now()
    WHERE articulo_id = NEW.articulo_id AND sucursal_id = v_sucursal_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aplicar_item_stock
  AFTER INSERT ON movimiento_stock_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_aplicar_item_stock();

CREATE OR REPLACE FUNCTION revertir_movimiento_stock(p_movimiento_id BIGINT)
RETURNS VOID AS $$
DECLARE
  v_mov movimientos_stock%ROWTYPE;
  v_tipo_nombre TEXT;
BEGIN
  SELECT * INTO v_mov FROM movimientos_stock WHERE id = p_movimiento_id;
  SELECT nombre INTO v_tipo_nombre FROM tipos_movimiento_stock WHERE id = v_mov.tipo_movimiento_stock_id;
  IF v_tipo_nombre = 'Ingreso' THEN
    UPDATE articulo_stock 
    SET stock_actual = stock_actual - v_mov.cantidad, actualizado_en = now()
    WHERE articulo_id = v_mov.articulo_id AND sucursal_id = v_mov.sucursal_id;
  ELSIF v_tipo_nombre = 'Egreso' THEN
    UPDATE articulo_stock 
    SET stock_actual = stock_actual + v_mov.cantidad, actualizado_en = now()
    WHERE articulo_id = v_mov.articulo_id AND sucursal_id = v_mov.sucursal_id;
  END IF;
  DELETE FROM movimientos_stock WHERE id = p_movimiento_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------
-- 2b. Limpieza: trigger/función viejos de stock (modelo cabecera-única)
--     Confirmado código muerto: 0 filas en movimientos_stock con cantidad
--     real bajo el modelo viejo. El modelo vigente es cabecera + items
--     (movimiento_stock_items), igual que sandbox.
-- ----------------------------------------------------------

DROP TRIGGER IF EXISTS trg_aplicar_movimiento_stock_confirmado ON movimientos_stock;
DROP FUNCTION IF EXISTS fn_aplicar_movimiento_stock_confirmado();

-- Columnas articulo_id/cantidad/sucursal_destino_id en movimientos_stock
-- quedan obsoletas (siempre NULL bajo el modelo vigente). Se documentan
-- para una limpieza de esquema futura, pero NO se eliminan en esta sesión
-- para no romper FKs ni código que aún pueda referenciarlas por error.
-- TODO sesión futura: DROP COLUMN articulo_id, cantidad, sucursal_destino_id
-- en movimientos_stock, una vez confirmado que ningún código las usa.

-- ----------------------------------------------------------
-- 3. reaperturas_caja: dropear estructura jsonb (sin uso) y recrear
--    con estructura de columnas individuales (la que usa reabrir_ultimo_cierre)
-- ----------------------------------------------------------

DROP TABLE IF EXISTS reaperturas_caja;

CREATE TABLE reaperturas_caja (
  id                          BIGSERIAL PRIMARY KEY,
  cierre_turno_id             BIGINT NOT NULL REFERENCES cierres_turno(id),
  usuario_id                  UUID NOT NULL REFERENCES usuarios(id),
  motivo                      TEXT,
  efectivo_real_original      NUMERIC(12,2),
  diferencia_original         NUMERIC(12,2),
  ingresos_sistema_original   NUMERIC(12,2),
  egresos_sistema_original    NUMERIC(12,2),
  resultado_sistema_original  NUMERIC(12,2),
  creado_en                   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reaperturas_caja ENABLE ROW LEVEL SECURITY;

-- Políticas RLS — ajustar según patrón ya usado en cierres_turno
CREATE POLICY "reaperturas_caja_select" ON reaperturas_caja
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "reaperturas_caja_insert" ON reaperturas_caja
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------
-- 4. Función reabrir_ultimo_cierre (copiada de sandbox)
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION reabrir_ultimo_cierre(
  p_sucursal_id BIGINT,
  p_usuario_id UUID,
  p_motivo TEXT
)
RETURNS BIGINT AS $$
DECLARE
  v_ultimo_id     BIGINT;
  v_hay_abierto   BIGINT;
  v_efectivo_real NUMERIC(12,2);
  v_diferencia    NUMERIC(12,2);
  v_ingresos      NUMERIC(12,2);
  v_egresos       NUMERIC(12,2);
  v_resultado     NUMERIC(12,2);
  v_apertura      NUMERIC(12,2);
BEGIN
  SELECT id INTO v_hay_abierto
  FROM cierres_turno
  WHERE sucursal_id = p_sucursal_id
    AND estado_cierre_turno_id = 1
  LIMIT 1;
  IF v_hay_abierto IS NOT NULL THEN
    RAISE EXCEPTION 'Ya hay una caja abierta (id=%). Cerrala primero.', v_hay_abierto;
  END IF;
  SELECT id, efectivo_real, diferencia, ingresos_sistema,
         egresos_sistema, resultado_sistema, apertura
  INTO v_ultimo_id, v_efectivo_real, v_diferencia, v_ingresos,
       v_egresos, v_resultado, v_apertura
  FROM cierres_turno
  WHERE sucursal_id = p_sucursal_id
    AND estado_cierre_turno_id != 1
  ORDER BY id DESC
  LIMIT 1;
  IF v_ultimo_id IS NULL THEN
    RAISE EXCEPTION 'No hay cierres anteriores para reabrir.';
  END IF;
  INSERT INTO reaperturas_caja (
    cierre_turno_id, usuario_id, motivo,
    efectivo_real_original, diferencia_original,
    ingresos_sistema_original, egresos_sistema_original,
    resultado_sistema_original
  ) VALUES (
    v_ultimo_id, p_usuario_id, p_motivo,
    v_efectivo_real, v_diferencia,
    v_ingresos, v_egresos, v_resultado
  );
  UPDATE cierres_turno SET
    estado_cierre_turno_id = 1,
    efectivo_real          = NULL,
    diferencia              = NULL,
    ingresos_sistema       = 0,
    egresos_sistema        = 0,
    resultado_sistema      = v_apertura,
    cantidad_reaperturas   = cantidad_reaperturas + 1
  WHERE id = v_ultimo_id;
  RETURN v_ultimo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FIN — verificar con SELECT antes de dar por cerrada la unificación
-- ============================================================
