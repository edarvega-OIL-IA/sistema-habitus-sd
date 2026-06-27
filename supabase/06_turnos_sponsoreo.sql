-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 06: TURNOS / CIERRES DE CAJA / SPONSOREO
-- ============================================================================
-- Orden de ejecución: 6 de 6 (depende de todos los anteriores)
-- Incluye:
--   - cierres_turno y retiros_caja (reemplaza planilla en papel)
--   - deportistas, sponsoreos, sponsoreo_items (Team Habitus, reemplaza
--     workaround de "venta con 100% de descuento")
--   - Recreación de fn_validar_origen_movimiento() para incluir validación
--     real de sponsoreos y cierres_turno (que recién existen en este archivo)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CIERRES DE TURNO Y CAJA EFECTIVO
-- ---------------------------------------------------------------------------

CREATE TABLE cierres_turno (
    id                      BIGSERIAL PRIMARY KEY,
    sucursal_id             BIGINT NOT NULL REFERENCES sucursales(id),
    turno_id                BIGINT NOT NULL REFERENCES turnos(id),
    usuario_id              UUID NOT NULL REFERENCES usuarios(id),
    estado_cierre_turno_id  BIGINT NOT NULL REFERENCES estados_cierre_turno(id),
    fecha                   DATE NOT NULL DEFAULT CURRENT_DATE,
    apertura                NUMERIC(12,2) NOT NULL DEFAULT 0,  -- efectivo real del cierre anterior (automático)
    ingresos_sistema        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- calculado por el sistema
    egresos_sistema         NUMERIC(12,2) NOT NULL DEFAULT 0,  -- calculado por el sistema
    resultado_sistema       NUMERIC(12,2) NOT NULL DEFAULT 0,  -- apertura + ingresos - egresos
    efectivo_real           NUMERIC(12,2),  -- lo que el cajero cuenta físicamente
    diferencia              NUMERIC(12,2),  -- efectivo_real - resultado_sistema
    observaciones           TEXT,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE cierres_turno IS
    'Reemplaza la planilla de papel diaria. Flujo: el sistema muestra cuánto
     efectivo espera encontrar en caja (resultado_sistema), el cajero cuenta
     el efectivo real y lo ingresa, el sistema calcula la diferencia.
     La apertura del turno siguiente = efectivo_real de este cierre (automático).';
COMMENT ON COLUMN cierres_turno.apertura IS
    'Efectivo real del cierre anterior, traído automáticamente por el sistema.
     En el primer cierre del sistema (migración desde coverweb) se carga
     manualmente el saldo inicial real de caja.';

CREATE TABLE retiros_caja (
    id              BIGSERIAL PRIMARY KEY,
    cierre_turno_id BIGINT NOT NULL REFERENCES cierres_turno(id),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    concepto        TEXT,
    fecha_utc       TIMESTAMPTZ NOT NULL DEFAULT now(),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE retiros_caja IS
    'Reemplaza la firma en papel de retiros de efectivo durante el turno.
     Cada retiro queda vinculado al cierre de turno en curso y al usuario
     que lo realizó.';

-- ---------------------------------------------------------------------------
-- TEAM HABITUS — SPONSOREO DE DEPORTISTAS
-- ---------------------------------------------------------------------------

CREATE TABLE deportistas (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    apellido        TEXT NOT NULL,
    dni             TEXT,
    telefono        TEXT,
    email           TEXT,
    deporte         TEXT,
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE deportistas IS
    'Los 8 deportistas locales activos sponsoreados por Team Habitus.
     El sponsoreo se registra a precio de costo (no precio de venta),
     reemplazando el workaround anterior de "venta con 100% de descuento".';

CREATE TABLE sponsoreos (
    id                  BIGSERIAL PRIMARY KEY,
    deportista_id       BIGINT NOT NULL REFERENCES deportistas(id),
    estado_sponsoreo_id BIGINT NOT NULL REFERENCES estados_sponsoreo(id),
    mes                 INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio                INTEGER NOT NULL CHECK (anio >= 2024),
    costo_total         NUMERIC(12,2) NOT NULL DEFAULT 0,  -- suma de costo de los items, calculado
    observaciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deportista_id, mes, anio)
);
COMMENT ON COLUMN sponsoreos.costo_total IS
    'Suma de (articulo.costo_sin_iva * cantidad) de todos los sponsoreo_items.
     Se calcula automáticamente al confirmar el sponsoreo, no al crear el borrador.
     Variable mes a mes según lo que pide cada deportista.';

CREATE TABLE sponsoreo_items (
    id              BIGSERIAL PRIMARY KEY,
    sponsoreo_id    BIGINT NOT NULL REFERENCES sponsoreos(id) ON DELETE CASCADE,
    articulo_id     BIGINT NOT NULL REFERENCES articulos(id),
    cantidad        NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    costo_unitario  NUMERIC(12,2) NOT NULL,  -- costo_sin_iva del artículo al momento del sponsoreo
    subtotal        NUMERIC(12,2) NOT NULL,  -- cantidad * costo_unitario
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN sponsoreo_items.costo_unitario IS
    'Se copia el costo_sin_iva del artículo al momento de confirmar el sponsoreo,
     no se referencia dinámicamente, para que quede trazabilidad histórica aunque
     el costo del artículo cambie en el futuro.';

-- ---------------------------------------------------------------------------
-- RECREAR fn_validar_origen_movimiento() con validación real de sponsoreos
-- y cierres_turno (que recién existen ahora en este archivo)
-- El CREATE OR REPLACE reemplaza la versión provisional del archivo 05
-- sin tocar los triggers que ya la referencian.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validar_origen_movimiento()
RETURNS TRIGGER AS $$
DECLARE
    v_existe BOOLEAN := false;
BEGIN
    IF NEW.origen_tipo IS NULL OR NEW.origen_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.origen_tipo = 'venta' THEN
        SELECT EXISTS(SELECT 1 FROM ventas WHERE id = NEW.origen_id) INTO v_existe;
    ELSIF NEW.origen_tipo = 'orden_compra' THEN
        SELECT EXISTS(SELECT 1 FROM ordenes_compra WHERE id = NEW.origen_id) INTO v_existe;
    ELSIF NEW.origen_tipo = 'sponsoreo' THEN
        SELECT EXISTS(SELECT 1 FROM sponsoreos WHERE id = NEW.origen_id) INTO v_existe;
    ELSIF NEW.origen_tipo = 'cierre_turno' THEN
        SELECT EXISTS(SELECT 1 FROM cierres_turno WHERE id = NEW.origen_id) INTO v_existe;
    ELSIF NEW.origen_tipo = 'manual' THEN
        v_existe := true;  -- movimiento manual no tiene origen_id real
    ELSE
        RAISE EXCEPTION 'origen_tipo desconocido: %', NEW.origen_tipo;
    END IF;

    IF NOT v_existe THEN
        RAISE EXCEPTION 'origen_id=% no existe para origen_tipo="%"',
            NEW.origen_id, NEW.origen_tipo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION fn_validar_origen_movimiento IS
    'Versión final (archivo 06): incluye validación real contra sponsoreos y
     cierres_turno, que no existían en el archivo 05 donde se creó la versión
     provisional. Los triggers trg_validar_origen_movimiento (en movimientos) y
     trg_validar_origen_movimiento_stock (en movimientos_stock) siguen apuntando
     a esta función sin necesidad de recrearlos.';

-- ============================================================================
-- RLS — Habilitar en todas las tablas de este archivo (sin políticas todavía)
-- ============================================================================

ALTER TABLE cierres_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE retiros_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE deportistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsoreos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsoreo_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIN DEL ARCHIVO 06 — ESQUEMA COMPLETO
-- ============================================================================
-- Tablas creadas en total (6 archivos):
--   01: paises, provincias, localidades, rubros, marcas, unidades_medida,
--       monedas, tasas_iva, condiciones_iva, estados_disponibilidad_web,
--       medios_pago, tarjetas, cuentas_bancarias, tipos_comprobante,
--       estados_fiscales, puntos_venta, estados_venta, estados_cobro,
--       tipos_cliente, tipos_precio, tipos_movimiento_stock,
--       estados_movimiento_stock, depositos, estados_orden_compra,
--       tipos_orden_compra, categorias_gasto, conceptos_gasto,
--       tipos_entidad, organismos, turnos, estados_cierre_turno,
--       estados_sponsoreo, roles, estados_usuario, sucursales (35 tablas)
--   01b: datos geográficos (sin tablas nuevas, solo INSERT + UPDATE)
--   02: usuarios, articulos, articulo_imagenes, articulo_stock,
--       articulo_precio_sucursal, clientes, proveedores (7 tablas)
--   03: configuracion_fiscal, numeracion_ventas, ventas, venta_items,
--       venta_pagos, numeracion_comprobantes, comprobantes,
--       intentos_fiscalizacion (8 tablas)
--   04: ordenes_compra, orden_compra_items, movimientos_stock (3 tablas)
--   05: cuentas, movimientos (2 tablas)
--   06: cierres_turno, retiros_caja, deportistas, sponsoreos,
--       sponsoreo_items (5 tablas)
--
-- TOTAL: 60 tablas
--
-- Próximos pasos:
--   1. Definir políticas RLS por tabla (lección LNT #7)
--   2. Mockups de pantallas principales (venta POS, cierre de turno,
--      orden de compra, movimientos)
--   3. Configurar proyecto Next.js 15 en sistema-habitus-sd/
-- ============================================================================
