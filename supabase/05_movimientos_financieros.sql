-- ============================================================================
-- HABITUS SD — Esquema SQL — Archivo 05: MOVIMIENTOS FINANCIEROS (LEDGER ÚNICO)
-- ============================================================================
-- Orden de ejecución: 5 de 6 (depende de 01, 01b, 02, 03, 04)
-- Arquitectura de dos niveles:
--   Nivel 1 (Operativo): ventas/compras/stock — pantallas simples, ya creadas.
--   Nivel 2 (Financiero): tabla única "movimientos" que registra automáticamente
--   todo impacto económico generado en el nivel 1.
-- Modelo polimórfico: entidad_tipo_id + entidad_id (con trigger de validación)
-- y origen_tipo + origen_id (mismo patrón, para rastrear qué operación generó
-- cada movimiento). Decisión tomada en sesión 01 tras evaluar 3 alternativas
-- (tabla contrapartes intermedia / FK reales múltiples / polimórfico).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CUENTAS — dónde está el dinero (efectivo caja, Mercado Pago, Patagonia, etc.)
-- ---------------------------------------------------------------------------

CREATE TABLE cuentas (
    id                  BIGSERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL UNIQUE,
    cuenta_bancaria_id  BIGINT REFERENCES cuentas_bancarias(id),  -- vincula a alias/banco si aplica
    sucursal_id         BIGINT REFERENCES sucursales(id),
    activo              BOOLEAN NOT NULL DEFAULT true,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE cuentas IS
    'Dónde está el dinero: Caja Efectivo (por sucursal), Mercado Pago EAV,
     Patagonia EAV, etc. Es la dimensión "Cuenta" del ledger único.';

INSERT INTO cuentas (nombre, sucursal_id) VALUES
    ('Caja Efectivo',
     (SELECT id FROM sucursales WHERE nombre = 'Cinco Saltos'));

INSERT INTO cuentas (nombre, cuenta_bancaria_id) VALUES
    ('Mercado Pago EAV',
     (SELECT id FROM cuentas_bancarias WHERE nombre = 'Mercado Pago EAV')),
    ('Patagonia EAV',
     (SELECT id FROM cuentas_bancarias WHERE nombre = 'Patagonia EAV')),
    ('Camino Doce Doce',
     (SELECT id FROM cuentas_bancarias WHERE nombre = 'Camino Doce Doce'));

-- ---------------------------------------------------------------------------
-- MOVIMIENTOS FINANCIEROS — tabla central del ledger único
-- ---------------------------------------------------------------------------

CREATE TABLE movimientos (
    id                  BIGSERIAL PRIMARY KEY,
    sucursal_id         BIGINT NOT NULL REFERENCES sucursales(id),
    cuenta_id           BIGINT NOT NULL REFERENCES cuentas(id),
    categoria_gasto_id  BIGINT NOT NULL REFERENCES categorias_gasto(id),
    concepto_gasto_id   BIGINT NOT NULL REFERENCES conceptos_gasto(id),
    tipo                TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Egreso')),
    monto               NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha_utc           TIMESTAMPTZ NOT NULL DEFAULT now(),
    mes_contable        DATE NOT NULL,  -- primer día del mes contable, ej. 2026-06-01

    -- Entidad involucrada (quién): modelo polimórfico
    entidad_tipo_id     BIGINT REFERENCES tipos_entidad(id),
    entidad_id          BIGINT,  -- FK real validada por trigger según entidad_tipo_id

    -- Origen operativo (qué generó este movimiento): modelo polimórfico
    origen_tipo         TEXT,    -- 'venta' | 'orden_compra' | 'sponsoreo' | 'cierre_turno' | 'manual'
    origen_id           BIGINT,  -- FK real validada por trigger según origen_tipo

    estado_cobro_id     BIGINT REFERENCES estados_cobro(id),
    medio_pago_id       BIGINT REFERENCES medios_pago(id),
    turno_id            BIGINT REFERENCES turnos(id),
    usuario_id          UUID REFERENCES usuarios(id),
    observaciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE movimientos IS
    'Tabla central del ledger único. Todo impacto económico del negocio genera
     una fila acá, ya sea automáticamente (via triggers desde ventas/compras/
     sponsoreo/cierres) o manualmente (gastos directos del módulo de movimientos).
     Terminología: Categoría=clasificación económica genérica (ej. "Compras
     Mercadería"), Concepto=subtipo (ej. "Sueldo"), Entidad=quién, Cuenta=dónde.';
COMMENT ON COLUMN movimientos.mes_contable IS
    'Primer día del mes al que pertenece este movimiento contablemente.
     Puede diferir de fecha_utc si se registra un gasto de mayo en junio.
     Siempre almacenar el día 1 del mes: 2026-06-01, no 2026-06-18.';
COMMENT ON COLUMN movimientos.entidad_id IS
    'FK polimórfica validada por trigger fn_validar_entidad_movimiento().
     Apunta a clientes.id, proveedores.id, usuarios.id, u organismos.id
     según el valor de entidad_tipo_id.';
COMMENT ON COLUMN movimientos.origen_id IS
    'FK polimórfica validada por trigger fn_validar_origen_movimiento().
     Apunta a ventas.id, ordenes_compra.id, sponsoreos.id, o
     cierres_turno.id según el valor de origen_tipo.';

-- ---------------------------------------------------------------------------
-- TRIGGER: validar entidad_tipo_id + entidad_id (modelo polimórfico)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validar_entidad_movimiento()
RETURNS TRIGGER AS $$
DECLARE
    v_tipo_nombre TEXT;
    v_existe BOOLEAN := false;
BEGIN
    -- Si no hay entidad, no hay nada que validar
    IF NEW.entidad_tipo_id IS NULL OR NEW.entidad_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT nombre INTO v_tipo_nombre FROM tipos_entidad WHERE id = NEW.entidad_tipo_id;

    IF v_tipo_nombre = 'Cliente' THEN
        SELECT EXISTS(SELECT 1 FROM clientes WHERE id = NEW.entidad_id) INTO v_existe;
    ELSIF v_tipo_nombre = 'Proveedor' THEN
        SELECT EXISTS(SELECT 1 FROM proveedores WHERE id = NEW.entidad_id) INTO v_existe;
    ELSIF v_tipo_nombre = 'Empleado' THEN
        SELECT EXISTS(SELECT 1 FROM usuarios WHERE id::TEXT = NEW.entidad_id::TEXT) INTO v_existe;
    ELSIF v_tipo_nombre = 'Organismo' THEN
        SELECT EXISTS(SELECT 1 FROM organismos WHERE id = NEW.entidad_id) INTO v_existe;
    ELSE
        RAISE EXCEPTION 'Tipo de entidad desconocido: %', v_tipo_nombre;
    END IF;

    IF NOT v_existe THEN
        RAISE EXCEPTION 'entidad_id=% no existe en la tabla correspondiente a tipo "%"',
            NEW.entidad_id, v_tipo_nombre;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_entidad_movimiento
    BEFORE INSERT OR UPDATE ON movimientos
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_entidad_movimiento();

-- ---------------------------------------------------------------------------
-- TRIGGER: validar origen_tipo + origen_id (mismo patrón polimórfico)
-- También aplica a movimientos_stock (origen_tipo/origen_id), centralizado acá
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
        -- sponsoreos se crea en archivo 06; si no existe todavía, se permite NULL
        -- El trigger se recrea en 06_turnos_sponsoreo.sql para incluir este caso
        v_existe := true;
    ELSIF NEW.origen_tipo = 'cierre_turno' THEN
        -- cierres_turno se crea en archivo 06; mismo criterio
        v_existe := true;
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

CREATE TRIGGER trg_validar_origen_movimiento
    BEFORE INSERT OR UPDATE ON movimientos
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_origen_movimiento();

-- Mismo trigger de validación de origen para movimientos_stock
-- (reutiliza la misma función ya que el patrón es idéntico)
CREATE TRIGGER trg_validar_origen_movimiento_stock
    BEFORE INSERT OR UPDATE ON movimientos_stock
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_origen_movimiento();

-- ============================================================================
-- RLS — Habilitar en todas las tablas de este archivo (sin políticas todavía)
-- ============================================================================

ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIN DEL ARCHIVO 05
-- Siguiente paso: ejecutar 06_turnos_sponsoreo.sql
-- El archivo 06 recrea fn_validar_origen_movimiento() para incluir validación
-- real de sponsoreos y cierres_turno (que recién existen en ese archivo).
-- ============================================================================
