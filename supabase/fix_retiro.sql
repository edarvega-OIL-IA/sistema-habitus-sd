DROP FUNCTION IF EXISTS registrar_retiro_caja(bigint, numeric, uuid, text);

CREATE OR REPLACE FUNCTION registrar_retiro_caja(
  p_cierre_turno_id BIGINT,
  p_monto           NUMERIC(12,2),
  p_usuario_id      UUID,
  p_concepto        TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retiro_id BIGINT;
BEGIN
  INSERT INTO retiros_caja (cierre_turno_id, monto, usuario_id, concepto)
  VALUES (p_cierre_turno_id, p_monto, p_usuario_id, p_concepto)
  RETURNING id INTO v_retiro_id;

  RETURN v_retiro_id;
END;
$$;

ALTER TABLE retiros_caja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retiros_caja_select" ON retiros_caja;
DROP POLICY IF EXISTS "retiros_caja_insert" ON retiros_caja;

CREATE POLICY "retiros_caja_select" ON retiros_caja
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "retiros_caja_insert" ON retiros_caja
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT EXECUTE ON FUNCTION registrar_retiro_caja TO authenticated;
