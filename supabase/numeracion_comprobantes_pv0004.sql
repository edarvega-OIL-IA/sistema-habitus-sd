INSERT INTO numeracion_comprobantes (punto_venta_id, tipo_comprobante_id, ultimo_numero)
SELECT 3, 1, 1
WHERE NOT EXISTS (
  SELECT 1 FROM numeracion_comprobantes
  WHERE punto_venta_id = 3 AND tipo_comprobante_id = 1
);
