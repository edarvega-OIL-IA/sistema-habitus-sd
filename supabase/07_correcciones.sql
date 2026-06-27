-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 07: CORRECCIONES POST-AUDITORÍA
-- ============================================================================
-- Orden de ejecución: después de 06_turnos_sponsoreo.sql
-- Origen: auditoría de arquitectura de datos (sesión 02, cierre)
-- Comparación: HABITUS_SD_ANALISIS_SESION01.md (41 secciones) vs esquema SQL
--
-- CORRECCIONES INCLUIDAS:
--   1. comprobantes.total          — requerido por AFIP/Facturama (sección 41)
--   2. comprobantes.impreso_enviado — contemplado en análisis y UI coverweb (sección 41)
--   3. ordenes_compra.flete_medio_pago_id — flete puede pagarse con medio distinto (sección 8)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CORRECCIÓN 1: comprobantes.total
-- ---------------------------------------------------------------------------
-- La sección 41 (decisión 1) especifica explícitamente este campo en el DDL
-- propuesto para comprobantes. Omitido por error en el archivo 03.
-- Es obligatorio para:
--   a) Envío a Facturama (requiere el importe total del comprobante)
--   b) Auditoría fiscal independiente de los cambios en ventas
--   c) Notas de crédito/débito que ajustan el total del comprobante original
-- ---------------------------------------------------------------------------

ALTER TABLE comprobantes
    ADD COLUMN total NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN comprobantes.total IS
    'Importe total del comprobante fiscal. Se copia desde ventas.total al moment
     de fiscalizar y queda fijo en el comprobante — independiente de cualquier
     modificación posterior en ventas. Requerido por Facturama para la emisión
     electrónica y por AFIP para la correlación del CAE.';

-- ---------------------------------------------------------------------------
-- CORRECCIÓN 2: comprobantes.impreso_enviado
-- ---------------------------------------------------------------------------
-- La sección 41 (decisión 1) incluye este campo en el DDL propuesto.
-- La UI de coverweb (sesión 02, imagen 3 "Datos de la Facturación") muestra
-- el campo "Enviar Comprobante / Email" — equivalente directo.
-- La política del negocio: la factura se emite siempre a AFIP cuando corresponde
-- pero NO se imprime ni envía salvo pedido explícito del cliente.
-- ---------------------------------------------------------------------------

ALTER TABLE comprobantes
    ADD COLUMN impreso_enviado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN comprobantes.impreso_enviado IS
    'Indica si el comprobante fue impreso en papel o enviado por email al cliente.
     Por política del negocio, la factura se emite siempre a AFIP cuando corresponde
     (estado_fiscal_id → CAE_Recibido), pero NO se imprime ni envía salvo pedido
     explícito. Este campo permite saber cuántos clientes efectivamente lo recibieron.';

-- ---------------------------------------------------------------------------
-- CORRECCIÓN 3: ordenes_compra.flete_medio_pago_id
-- ---------------------------------------------------------------------------
-- La sección 8 del análisis especifica:
--   "Flete: puede tener medio de pago diferente al del pedido"
--   "Black: cobra flete junto con la mercadería en la misma transferencia,
--    pero el desglose es conocido"
-- El esquema original tenía flete_monto pero no flete_medio_pago_id,
-- lo que impedía registrar cómo se pagó el flete.
-- ---------------------------------------------------------------------------

ALTER TABLE ordenes_compra
    ADD COLUMN flete_medio_pago_id BIGINT REFERENCES medios_pago(id);

COMMENT ON COLUMN ordenes_compra.flete_medio_pago_id IS
    'Medio de pago del flete, que puede diferir del medio de pago del pedido.
     Ejemplo real: Black Suplementos cobra flete en la misma transferencia que
     la mercadería, pero el monto desglosado es conocido. NULL = mismo medio
     que el pedido general (caso más frecuente).';

-- ============================================================================
-- VERIFICACIÓN — consultar que las columnas quedaron agregadas correctamente
-- ============================================================================

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('comprobantes', 'ordenes_compra')
  AND column_name IN ('total', 'impreso_enviado', 'flete_medio_pago_id')
ORDER BY table_name, column_name;

-- ============================================================================
-- FIN DEL ARCHIVO 07
-- Resultado esperado: 3 filas en la consulta de verificación:
--   comprobantes      | impreso_enviado    | boolean | NO | false
--   comprobantes      | total              | numeric | NO | 0
--   ordenes_compra    | flete_medio_pago_id| bigint  | YES| null
-- ============================================================================
