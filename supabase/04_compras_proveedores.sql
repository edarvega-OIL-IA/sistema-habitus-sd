-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 04: COMPRAS / PROVEEDORES / MOVIMIENTOS DE STOCK
-- ============================================================================
-- Orden de ejecución: 4 de 6 (depende de 01, 01b, 02, 03)
-- Sin formalidad fiscal: proveedores son monotributistas/informales, no se
-- deduce IVA. tiene_comprobante distingue modo rápido (sin nro factura/remito)
-- de modo completo (con esos datos, solo registro interno).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ÓRDENES DE COMPRA
-- ---------------------------------------------------------------------------

CREATE TABLE ordenes_compra (
    id                      BIGSERIAL PRIMARY KEY,
    numero_orden            BIGSERIAL,  -- correlativo interno, sin exigencia fiscal (no aplica el patrón atómico de ventas)
    proveedor_id            BIGINT NOT NULL REFERENCES proveedores(id),
    sucursal_id             BIGINT NOT NULL REFERENCES sucursales(id),
    deposito_id             BIGINT REFERENCES depositos(id),
    usuario_id              UUID NOT NULL REFERENCES usuarios(id),
    tipo_orden_compra_id    BIGINT NOT NULL REFERENCES tipos_orden_compra(id),  -- Rápida / Completa
    estado_orden_compra_id  BIGINT NOT NULL REFERENCES estados_orden_compra(id),
    tiene_comprobante       BOOLEAN NOT NULL DEFAULT false,
    numero_factura_proveedor TEXT,   -- solo modo completo
    numero_remito_proveedor  TEXT,   -- solo modo completo
    numero_pedido_externo     TEXT,   -- número de pedido del proveedor, opcional, ambos modos
    fecha_factura            DATE,    -- solo modo completo
    fecha_remito              DATE,    -- solo modo completo
    fecha_orden               DATE NOT NULL DEFAULT CURRENT_DATE,
    descuento_pct             NUMERIC(5,2) NOT NULL DEFAULT 0,
    flete_monto                NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total                       NUMERIC(12,2) NOT NULL DEFAULT 0,
    observaciones                TEXT,
    creado_en                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN ordenes_compra.tiene_comprobante IS
    'false = modo rápido (proveedor + fecha + items + cantidades + precios +
     descuento + flete + notas, sin exigencia fiscal). true = modo completo
     (agrega número de factura/remito + fechas, solo para registro interno,
     el proveedor no es responsable inscripto en la mayoría de los casos).';
COMMENT ON COLUMN ordenes_compra.flete_monto IS
    'Monto separado del costo de los artículos. Se redistribuye proporcionalmente
     en el costo de cada artículo de la orden al confirmar (ver función de
     redistribución más abajo), nunca se carga como línea de item suelta.';

CREATE TABLE orden_compra_items (
    id                      BIGSERIAL PRIMARY KEY,
    orden_compra_id         BIGINT NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    articulo_id             BIGINT NOT NULL REFERENCES articulos(id),
    cantidad_facturada      NUMERIC(12,2) NOT NULL,
    cantidad_recibida       NUMERIC(12,2) NOT NULL,
    precio_unitario_sin_iva NUMERIC(12,2) NOT NULL,
    flete_prorrateado       NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_final_unitario    NUMERIC(12,2),  -- precio_unitario_sin_iva + flete_prorrateado/cantidad_recibida, calculado al confirmar
    subtotal                NUMERIC(12,2) NOT NULL,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN orden_compra_items.cantidad_facturada IS
    'Distinta de cantidad_recibida para soportar promociones tipo 12+1: se
     facturan 12 unidades pero se reciben 13 físicamente en el local.';

-- Función que redistribuye el flete proporcionalmente entre los items de una
-- orden de compra, según el subtotal de cada item respecto al subtotal total.
CREATE OR REPLACE FUNCTION redistribuir_flete_orden_compra(p_orden_compra_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_subtotal_total NUMERIC(12,2);
    v_flete_total    NUMERIC(12,2);
BEGIN
    SELECT subtotal, flete_monto INTO v_subtotal_total, v_flete_total
    FROM ordenes_compra WHERE id = p_orden_compra_id;

    IF v_subtotal_total IS NULL OR v_subtotal_total = 0 THEN
        RETURN;  -- nada que redistribuir
    END IF;

    UPDATE orden_compra_items oci
    SET flete_prorrateado = ROUND(v_flete_total * (oci.subtotal / v_subtotal_total), 2),
        costo_final_unitario = oci.precio_unitario_sin_iva
            + ROUND(v_flete_total * (oci.subtotal / v_subtotal_total), 2) / oci.cantidad_recibida
    WHERE oci.orden_compra_id = p_orden_compra_id;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION redistribuir_flete_orden_compra IS
    'Se invoca al confirmar una orden de compra (no al guardar en borrador).
     Redistribuye flete_monto proporcionalmente al subtotal de cada item,
     y recalcula costo_final_unitario usando cantidad_recibida (no facturada),
     porque el costo real por unidad debe prorratearse sobre lo que efectivamente
     entró al depósito.';

-- ---------------------------------------------------------------------------
-- MOVIMIENTOS DE STOCK
-- ---------------------------------------------------------------------------

CREATE TABLE movimientos_stock (
    id                          BIGSERIAL PRIMARY KEY,
    articulo_id                 BIGINT NOT NULL REFERENCES articulos(id),
    sucursal_id                 BIGINT NOT NULL REFERENCES sucursales(id),
    tipo_movimiento_stock_id    BIGINT NOT NULL REFERENCES tipos_movimiento_stock(id),  -- Ingreso/Egreso/Transferencia
    estado_movimiento_stock_id  BIGINT NOT NULL REFERENCES estados_movimiento_stock(id),  -- Pendiente/Confirmado
    cantidad                    NUMERIC(12,2) NOT NULL,
    sucursal_destino_id          BIGINT REFERENCES sucursales(id),  -- solo para Transferencia
    origen_tipo                  TEXT,   -- 'venta' | 'orden_compra' | 'sponsoreo' | 'manual', ver patrón polimórfico en 05
    origen_id                    BIGINT,
    observaciones                 TEXT,
    fecha_utc                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    creado_en                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN movimientos_stock.origen_tipo IS
    'Mismo patrón polimórfico que se usa en movimientos financieros (ver archivo 05):
     identifica qué operación generó este movimiento de stock. Por ejemplo, al
     confirmar una orden de compra se genera un movimiento con origen_tipo=
     "orden_compra" y origen_id=<id de la orden>. El trigger de validación
     completo (que verifica existencia real según el tipo) se centraliza en el
     archivo 05 junto con el de movimientos financieros, por ser el mismo patrón.';

-- Trigger: actualizar articulo_stock automáticamente cuando un movimiento pasa a Confirmado
CREATE OR REPLACE FUNCTION fn_aplicar_movimiento_stock_confirmado()
RETURNS TRIGGER AS $$
DECLARE
    v_signo INTEGER;
    v_estado_confirmado_id BIGINT;
    v_tipo_transferencia_id BIGINT;
    v_debe_aplicar BOOLEAN;
BEGIN
    SELECT id INTO v_estado_confirmado_id FROM estados_movimiento_stock WHERE nombre = 'Confirmado';
    SELECT id INTO v_tipo_transferencia_id FROM tipos_movimiento_stock WHERE nombre = 'Transferencia';

    -- En INSERT: aplicar solo si nace directamente confirmado.
    -- En UPDATE: aplicar solo si recién ahora pasa a confirmado (antes no lo estaba).
    -- TG_OP distingue el tipo de operación sin necesidad de referenciar OLD en un INSERT.
    IF TG_OP = 'INSERT' THEN
        v_debe_aplicar := (NEW.estado_movimiento_stock_id = v_estado_confirmado_id);
    ELSE
        v_debe_aplicar := (NEW.estado_movimiento_stock_id = v_estado_confirmado_id
                            AND OLD.estado_movimiento_stock_id IS DISTINCT FROM v_estado_confirmado_id);
    END IF;

    IF v_debe_aplicar THEN
        IF NEW.tipo_movimiento_stock_id = v_tipo_transferencia_id THEN
            -- Resta en sucursal origen, suma en sucursal destino
            UPDATE articulo_stock SET stock_actual = stock_actual - NEW.cantidad, actualizado_en = now()
            WHERE articulo_id = NEW.articulo_id AND sucursal_id = NEW.sucursal_id;

            INSERT INTO articulo_stock (articulo_id, sucursal_id, stock_actual)
            VALUES (NEW.articulo_id, NEW.sucursal_destino_id, NEW.cantidad)
            ON CONFLICT (articulo_id, sucursal_id)
            DO UPDATE SET stock_actual = articulo_stock.stock_actual + NEW.cantidad, actualizado_en = now();
        ELSE
            SELECT CASE WHEN tms.nombre = 'Egreso' THEN -1 ELSE 1 END INTO v_signo
            FROM tipos_movimiento_stock tms WHERE tms.id = NEW.tipo_movimiento_stock_id;

            UPDATE articulo_stock SET stock_actual = stock_actual + (v_signo * NEW.cantidad), actualizado_en = now()
            WHERE articulo_id = NEW.articulo_id AND sucursal_id = NEW.sucursal_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aplicar_movimiento_stock_confirmado
    AFTER INSERT OR UPDATE ON movimientos_stock
    FOR EACH ROW
    EXECUTE FUNCTION fn_aplicar_movimiento_stock_confirmado();
COMMENT ON TRIGGER trg_aplicar_movimiento_stock_confirmado ON movimientos_stock IS
    'Aplica el impacto real en articulo_stock solo cuando el movimiento pasa a
     Confirmado, no cuando queda en Pendiente. Evita descuentos de stock
     prematuros por movimientos que todavía no se validaron.';

-- ============================================================================
-- RLS — Habilitar en todas las tablas de este archivo (sin políticas todavía)
-- ============================================================================

ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIN DEL ARCHIVO 04
-- Siguiente paso: ejecutar 05_movimientos_financieros.sql
-- ============================================================================
