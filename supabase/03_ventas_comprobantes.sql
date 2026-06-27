-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 03: VENTAS / COMPROBANTES / FISCALIZACIÓN
-- ============================================================================
-- Orden de ejecución: 3 de 6 (depende de 01, 01b, 02)
-- Incluye la resolución del pendiente técnico de numeración correlativa atómica
-- (sección 6, punto 5 del estado del proyecto) vía tabla + UPDATE...RETURNING,
-- que bloquea la fila durante toda la transacción (equivalente a SELECT...FOR UPDATE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CONDICIONES DE IVA — completar datos pendientes de 01_referencia.sql
-- ---------------------------------------------------------------------------
-- La tabla condiciones_iva se creó vacía en 01_referencia.sql (omisión a corregir
-- acá, no se vuelve a tocar ese archivo ya ejecutado). Se cargan los valores
-- estándar de AFIP antes de usarla en configuracion_fiscal.

INSERT INTO condiciones_iva (nombre) VALUES
    ('Responsable Inscripto'),
    ('Monotributista'),
    ('Exento'),
    ('Consumidor Final'),
    ('No Responsable');

-- ---------------------------------------------------------------------------
-- CONFIGURACIÓN FISCAL — única, multi-CUIT descartado explícitamente
-- ---------------------------------------------------------------------------

CREATE TABLE configuracion_fiscal (
    id                  BIGSERIAL PRIMARY KEY,
    cuit                TEXT NOT NULL,
    razon_social        TEXT NOT NULL,
    condicion_iva_id    BIGINT NOT NULL REFERENCES condiciones_iva(id),  -- Monotributista
    actividad_afip      TEXT,  -- código de actividad, ej. 476310
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE configuracion_fiscal IS
    'Tabla única (1 sola fila). Multi-CUIT descartado explícitamente: Habitus siempre
     va a ser un único CUIT. El traspaso histórico Enzo PV0007 -> Ariel PV0003 fue
     cambio de titularidad, no multi-entidad. No usar tabla "empresas".';

-- Constraint que garantiza que solo pueda existir una fila en esta tabla
CREATE UNIQUE INDEX idx_configuracion_fiscal_singleton ON configuracion_fiscal ((true));

INSERT INTO configuracion_fiscal (cuit, razon_social, condicion_iva_id, actividad_afip)
VALUES (
    '23-23890071-9',
    'Vega, Ariel',
    (SELECT id FROM condiciones_iva WHERE nombre = 'Monotributista'),
    '476310'
);

-- ---------------------------------------------------------------------------
-- NUMERACIÓN INTERNA DE VENTAS — mismo patrón atómico que numeracion_comprobantes
-- ---------------------------------------------------------------------------
-- Una secuencia (SERIAL/BIGSERIAL) común NO garantiza "sin huecos": si una
-- transacción consume un número y luego se aborta (corte de luz, conexión caída,
-- cajero cierra a mitad de carga), ese número queda consumido para siempre sin
-- fila asociada. Se aplica el mismo patrón que numeracion_comprobantes: una
-- tabla de control + función que solo incrementa el número dentro de la misma
-- transacción que efectivamente inserta la venta, nunca antes.

CREATE TABLE numeracion_ventas (
    id              BIGSERIAL PRIMARY KEY,
    ultimo_numero   BIGINT NOT NULL DEFAULT 0
);
COMMENT ON TABLE numeracion_ventas IS
    'Fila única de control. No depende de punto de venta ni tipo de comprobante
     porque numero_venta es un correlativo interno único para todo el negocio,
     independiente de si la venta fiscaliza o no.';

INSERT INTO numeracion_ventas (ultimo_numero) VALUES (1293);
COMMENT ON COLUMN numeracion_ventas.ultimo_numero IS
    'Inicializado en 1293 continuando desde el último número real visto en
     coverweb (serie "Guardado") al momento de la migración, según reporte de
     caja de la sesión 02. AJUSTAR este valor con el número real más reciente
     al momento de la migración final.';

CREATE OR REPLACE FUNCTION obtener_proximo_numero_venta()
RETURNS BIGINT AS $$
DECLARE
    v_numero BIGINT;
BEGIN
    UPDATE numeracion_ventas
       SET ultimo_numero = ultimo_numero + 1
    RETURNING ultimo_numero INTO v_numero;

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- VENTAS
-- ---------------------------------------------------------------------------

CREATE TABLE ventas (
    id                  BIGSERIAL PRIMARY KEY,
    numero_venta        BIGINT NOT NULL UNIQUE,  -- asignado vía obtener_proximo_numero_venta(), nunca a mano
    cliente_id          BIGINT NOT NULL REFERENCES clientes(id),
    sucursal_id         BIGINT NOT NULL REFERENCES sucursales(id),
    usuario_id          UUID NOT NULL REFERENCES usuarios(id),  -- vendedor/cajero
    estado_venta_id     BIGINT NOT NULL REFERENCES estados_venta(id),
    descuento_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    recargo_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
    total               NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones       TEXT,
    fecha_utc           TIMESTAMPTZ NOT NULL DEFAULT now(),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN ventas.numero_venta IS
    'Correlativo interno de control, totalmente independiente de la numeración
     fiscal (que vive en numeracion_comprobantes). Toda venta tiene uno, fiscalice
     o no. No tiene validez ante AFIP. Se obtiene SIEMPRE invocando
     obtener_proximo_numero_venta() dentro de la misma transacción que inserta
     la fila — nunca antes, nunca como paso separado que pueda abortarse.';

CREATE TABLE venta_items (
    id              BIGSERIAL PRIMARY KEY,
    venta_id        BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id),
    cantidad        NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    descuento_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,  -- descuento por línea
    subtotal        NUMERIC(12,2) NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venta_pagos (
    id              BIGSERIAL PRIMARY KEY,
    venta_id        BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    medio_pago_id   BIGINT NOT NULL REFERENCES medios_pago(id),
    monto           NUMERIC(12,2) NOT NULL,
    tarjeta_id       BIGINT REFERENCES tarjetas(id),
    cupon           TEXT,
    numero_autorizacion TEXT,
    cuenta_bancaria_id  BIGINT REFERENCES cuentas_bancarias(id),
    referencia      TEXT,  -- últimos 4 dígitos CVU o nombre cliente, MVP inicial sin webhook MP
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE venta_pagos IS
    'Permite multi-pago real en una sola venta (ej. efectivo + tarjeta simultáneo).
     El campo referencia es para el MVP inicial sin webhook de Mercado Pago: el
     cajero anota a mano los últimos 4 dígitos del CVU o el nombre del cliente,
     cargado en la misma pantalla de cobro sin popup separado.';

-- ---------------------------------------------------------------------------
-- NUMERACIÓN CORRELATIVA ATÓMICA — resuelve el pendiente técnico de la auditoría AFIP
-- ---------------------------------------------------------------------------

CREATE TABLE numeracion_comprobantes (
    id                      BIGSERIAL PRIMARY KEY,
    punto_venta_id          BIGINT NOT NULL REFERENCES puntos_venta(id),
    tipo_comprobante_id     BIGINT NOT NULL REFERENCES tipos_comprobante(id),
    ultimo_numero           BIGINT NOT NULL DEFAULT 0,
    UNIQUE (punto_venta_id, tipo_comprobante_id)
);
COMMENT ON TABLE numeracion_comprobantes IS
    'Control de numeración correlativa sin huecos, exigida por AFIP, por combinación
     punto_venta + tipo_comprobante. La función obtener_proximo_numero_comprobante()
     es la única vía permitida para incrementar este número (nunca incrementar
     ultimo_numero manualmente ni leerlo sin pasar por la función).';

-- Función que entrega el próximo número de forma atómica.
-- UPDATE...RETURNING de una sola fila ya es atómico en Postgres: bloquea la fila
-- durante toda la transacción que la invoca, equivalente a SELECT...FOR UPDATE
-- pero más simple y con menor superficie de error de uso.
CREATE OR REPLACE FUNCTION obtener_proximo_numero_comprobante(
    p_punto_venta_id BIGINT,
    p_tipo_comprobante_id BIGINT
) RETURNS BIGINT AS $$
DECLARE
    v_numero BIGINT;
BEGIN
    UPDATE numeracion_comprobantes
       SET ultimo_numero = ultimo_numero + 1
     WHERE punto_venta_id = p_punto_venta_id
       AND tipo_comprobante_id = p_tipo_comprobante_id
    RETURNING ultimo_numero INTO v_numero;

    IF v_numero IS NULL THEN
        RAISE EXCEPTION 'No existe numeración configurada para punto_venta_id=% y tipo_comprobante_id=%',
            p_punto_venta_id, p_tipo_comprobante_id;
    END IF;

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Inicializar numeración para Factura en el PV 0003 (continuando desde el último
-- número real usado en coverweb al momento de la migración: 00000360, según
-- captura de pantalla de la sesión 02. AJUSTAR este valor al momento de la
-- migración final con el número real más reciente de coverweb).
INSERT INTO numeracion_comprobantes (punto_venta_id, tipo_comprobante_id, ultimo_numero)
VALUES (
    (SELECT id FROM puntos_venta WHERE numero = 3),
    (SELECT id FROM tipos_comprobante WHERE nombre = 'Factura'),
    360
);

-- ---------------------------------------------------------------------------
-- COMPROBANTES — solo existen para ventas fiscalizadas
-- ---------------------------------------------------------------------------

CREATE TABLE comprobantes (
    id                          BIGSERIAL PRIMARY KEY,
    venta_id                    BIGINT NOT NULL UNIQUE REFERENCES ventas(id),
    tipo_comprobante_id         BIGINT NOT NULL REFERENCES tipos_comprobante(id),
    punto_venta_id              BIGINT NOT NULL REFERENCES puntos_venta(id),
    numero                      BIGINT NOT NULL,
    comprobante_asociado_id     BIGINT REFERENCES comprobantes(id),  -- self-FK: NC/ND referencian la factura que ajustan
    estado_fiscal_id            BIGINT NOT NULL REFERENCES estados_fiscales(id),
    factura_cae                 TEXT,
    factura_cae_vencimiento     DATE,
    fecha_emision_utc           TIMESTAMPTZ NOT NULL DEFAULT now(),
    fiscalizacion_intentos      INTEGER NOT NULL DEFAULT 0,
    creado_en                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (punto_venta_id, tipo_comprobante_id, numero)
);
COMMENT ON COLUMN comprobantes.comprobante_asociado_id IS
    'Self-FK. Una Nota de Crédito o Nota de Débito referencia acá la Factura
     original que ajusta. NULL para Facturas (no ajustan a nada).';
COMMENT ON COLUMN comprobantes.factura_cae IS
    'Índice único aplicado abajo. NULL mientras el estado_fiscal sea Pendiente
     o Reintentando; se completa al recibir CAE_Recibido.';

-- Índice único en factura_cae (parcial: solo cuando no es NULL), pendiente del ERD ya resuelto acá
CREATE UNIQUE INDEX idx_comprobantes_factura_cae_unico
    ON comprobantes (factura_cae)
    WHERE factura_cae IS NOT NULL;

-- ---------------------------------------------------------------------------
-- INTENTOS DE FISCALIZACIÓN — respuesta cruda de Facturama en cada intento
-- ---------------------------------------------------------------------------

CREATE TABLE intentos_fiscalizacion (
    id                  BIGSERIAL PRIMARY KEY,
    comprobante_id      BIGINT NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
    numero_intento      INTEGER NOT NULL,
    fecha_hora_utc      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resultado           TEXT NOT NULL,  -- ej. "exito", "error_red", "rechazado_afip"
    respuesta_cruda_json JSONB,
    mensaje_error       TEXT,
    UNIQUE (comprobante_id, numero_intento)
);
COMMENT ON TABLE intentos_fiscalizacion IS
    'Guarda la respuesta cruda (JSON) de Facturama en cada intento, éxito o error,
     para auditoría y debugging sin depender de logs externos.';

-- ============================================================================
-- RLS — Habilitar en todas las tablas de este archivo (sin políticas todavía)
-- ============================================================================

ALTER TABLE configuracion_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeracion_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeracion_comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intentos_fiscalizacion ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIN DEL ARCHIVO 03
-- Siguiente paso: ejecutar 04_compras_proveedores.sql
-- ============================================================================
