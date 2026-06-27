-- ============================================================
-- CIERRE DE TURNO — funciones PostgreSQL
-- Ejecutar en Supabase SQL Editor (habitus-sd-sandbox)
-- ============================================================

-- Función: abrir turno
CREATE OR REPLACE FUNCTION abrir_turno(
  p_sucursal_id BIGINT,
  p_turno_id    BIGINT,
  p_usuario_id  UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_apertura  NUMERIC(12,2) := 0;
  v_cierre_id BIGINT;
  v_abierto   BIGINT;
BEGIN
  -- Verificar que no haya turno abierto para esta sucursal
  SELECT id INTO v_abierto
  FROM cierres_turno
  WHERE sucursal_id = p_sucursal_id
    AND estado_cierre_turno_id = 1
  LIMIT 1;

  IF v_abierto IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe un turno abierto (id=%). Cerrarlo antes de abrir uno nuevo.', v_abierto;
  END IF;

  -- Apertura = efectivo_real del último cierre confirmado
  SELECT COALESCE(efectivo_real, 0) INTO v_apertura
  FROM cierres_turno
  WHERE sucursal_id = p_sucursal_id
    AND estado_cierre_turno_id != 1
  ORDER BY fecha DESC, id DESC
  LIMIT 1;

  INSERT INTO cierres_turno (
    sucursal_id, turno_id, usuario_id,
    estado_cierre_turno_id,
    fecha,
    apertura,
    ingresos_sistema, egresos_sistema, resultado_sistema,
    efectivo_real, diferencia
  ) VALUES (
    p_sucursal_id, p_turno_id, p_usuario_id,
    1,              -- Abierto
    CURRENT_DATE,
    v_apertura,
    0, 0, v_apertura,
    0, 0
  )
  RETURNING id INTO v_cierre_id;

  RETURN v_cierre_id;
END;
$$;

-- Función: cerrar turno
CREATE OR REPLACE FUNCTION cerrar_turno(
  p_cierre_id     BIGINT,
  p_efectivo_real NUMERIC(12,2),
  p_observaciones TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  -- Obtener datos del turno abierto
  SELECT apertura, sucursal_id, creado_en
  INTO v_apertura, v_sucursal_id, v_creado_en
  FROM cierres_turno
  WHERE id = p_cierre_id AND estado_cierre_turno_id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno no encontrado o ya cerrado (id=%).', p_cierre_id;
  END IF;

  -- Ventas en efectivo desde la apertura del turno (medio_pago_id = 1 = Efectivo)
  SELECT COALESCE(SUM(vp.monto), 0) INTO v_ingresos
  FROM ventas v
  JOIN venta_pagos vp ON vp.venta_id = v.id
  WHERE v.sucursal_id = v_sucursal_id
    AND vp.medio_pago_id = 1
    AND v.creado_en >= v_creado_en
    AND v.estado_venta_id != 3;  -- excluir anuladas

  -- Egresos en efectivo desde la apertura
  SELECT COALESCE(SUM(m.monto), 0) INTO v_egresos
  FROM movimientos m
  WHERE m.sucursal_id = v_sucursal_id
    AND m.tipo = 'Egreso'
    AND m.medio_pago_id = 1
    AND m.creado_en >= v_creado_en;

  -- Retiros de caja desde la apertura
  SELECT COALESCE(SUM(rc.monto), 0) INTO v_retiros
  FROM retiros_caja rc
  WHERE rc.sucursal_id = v_sucursal_id
    AND rc.creado_en >= v_creado_en;

  v_resultado  := v_apertura + v_ingresos - v_egresos - v_retiros;
  v_diferencia := p_efectivo_real - v_resultado;

  -- Estado: 2 = sin diferencia, 3 = con diferencia
  v_estado_nuevo := CASE WHEN ABS(v_diferencia) < 0.01 THEN 2 ELSE 3 END;

  UPDATE cierres_turno SET
    estado_cierre_turno_id = v_estado_nuevo,
    ingresos_sistema       = v_ingresos,
    egresos_sistema        = v_egresos + v_retiros,
    resultado_sistema      = v_resultado,
    efectivo_real          = p_efectivo_real,
    diferencia             = v_diferencia,
    observaciones          = p_observaciones
  WHERE id = p_cierre_id;
END;
$$;

-- Función: registrar retiro de caja
CREATE OR REPLACE FUNCTION registrar_retiro_caja(
  p_sucursal_id   BIGINT,
  p_monto         NUMERIC(12,2),
  p_usuario_id    UUID,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retiro_id BIGINT;
BEGIN
  INSERT INTO retiros_caja (sucursal_id, monto, usuario_id, observaciones)
  VALUES (p_sucursal_id, p_monto, p_usuario_id, p_observaciones)
  RETURNING id INTO v_retiro_id;

  RETURN v_retiro_id;
END;
$$;

-- RLS: cierres_turno
ALTER TABLE cierres_turno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cierres_turno_select" ON cierres_turno;
DROP POLICY IF EXISTS "cierres_turno_insert" ON cierres_turno;
DROP POLICY IF EXISTS "cierres_turno_update" ON cierres_turno;

CREATE POLICY "cierres_turno_select" ON cierres_turno
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cierres_turno_insert" ON cierres_turno
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cierres_turno_update" ON cierres_turno
  FOR UPDATE TO authenticated USING (true);

-- RLS: retiros_caja
ALTER TABLE retiros_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retiros_caja_select" ON retiros_caja;
DROP POLICY IF EXISTS "retiros_caja_insert" ON retiros_caja;

CREATE POLICY "retiros_caja_select" ON retiros_caja
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "retiros_caja_insert" ON retiros_caja
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT EXECUTE ON FUNCTION abrir_turno TO authenticated;
GRANT EXECUTE ON FUNCTION cerrar_turno TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_retiro_caja TO authenticated;
