# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 30/06/2026 — Sesión 14 (producción en vivo + unificación sandbox/producción completada)
**Estado general:** 🟢 Sistema en producción real desde 29/06. Sandbox y producción unificados (Tarea 3 cerrada).
**Próxima acción concreta:** Conteo físico de stock (Ariel) → UPDATE articulo_stock en producción

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `supabase/01_referencia.sql` ✅ al `supabase/08_cierre_turno.sql` ✅ — todos ejecutados

---

## 2. El negocio en una línea

Habitus SD: local de suplementos deportivos (Av. Roca 54, Cinco Saltos, Río Negro) + tienda online habitussd.com. Dueño Ariel Vega (monotributista), un empleado (Agustín, Lun-Vie). Objetivo: reemplazar coverweb.com.ar ($204.900/mes) + Empretienda ($9.490/mes) por sistema propio. Ahorro neto estimado ~$194.000/mes.

---

## 3. Stack tecnológico — CONFIRMADO

| Capa | Tecnología |
|---|---|
| Frontend/Backend | Next.js 16 (App Router) + TypeScript |
| Base de datos | Supabase (PostgreSQL + RLS + Auth) |
| Estilos / UI | Tailwind + shadcn/ui |
| Formularios | React Hook Form + Zod |
| Fechas | date-fns / date-fns-tz |
| Facturación AFIP | Facturama |
| Pagos (MVP v2) | Mercado Pago (webhooks) |
| Tipografía sistema | Inter (Google Fonts) — reemplaza Geist |
| Modo offline | No contemplado |

---

## 4. Módulos confirmados (orden de prioridad)

1. Artículos / Inventario ✅
2. Órdenes de Compra simplificadas ✅ (nueva, editar, listado con detalle)
3. Movimientos de Stock ✅ (incluyendo edición)
4. Ventas (carrito, modo POS, multi-pago) ✅
5. Movimientos financieros (ledger único) ✅
6. **Caja** (ex Cierre de turno) ✅
7. **Dashboard** ← próximo
8. Reportes
9. Facturación AFIP automática
10. Vitrina web propia (reemplaza Empretienda)
11. Team Habitus (sponsoreo a deportistas, a costo)

---

## 5. Infraestructura Supabase

- Organización: **Camino Doce Doce - IT**
- Proyecto activo: **habitus-sd-sandbox** (AWS sa-east-1, plan Free)
- Proyecto producción: pendiente

---

## 6. Decisiones pendientes

- [ ] Hosting / despliegue concreto
- [ ] Tipografías web: licenciar Antique Olive Nord D + Futura MD BT, o alternativas Google Fonts
- [ ] Producción Supabase: plan Pro vs pausar sistema-turnos-lnt
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI (los demás módulos ya lo tienen)
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2 filas amarillas: −$28.000 del 30/06/2026)
- [ ] Pantalla de ABM de Categorías y Conceptos de movimientos (post-MVP)
- [ ] Reorganización del menú lateral (post-MVP)
- [ ] Editar historial de cierres de caja (Admin, pantalla separada) — post-MVP
- [ ] Indicador de rentabilidad caída en listado de artículos (rojo si margen bajó >5% desde última compra)
- [ ] Pantalla masiva de actualización de precios (aumentar % por rubro/marca)
- [ ] MVP v2: modificar ventas Guardadas, Nota de Crédito, fiscalización AFIP/ARCA vía Facturama

---

## 7. Pantallas operativas al cierre de sesión 10

1. Listado de artículos ✅ (con stock, filtros Disponibilidad y Stock)
2. Formulario artículo — 5 solapas ✅
3. Listado de movimientos financieros ✅ (filtros Día/Mes/Año/Libre/Todos + totales arriba)
4. Formulario nuevo movimiento financiero ✅
5. Listado de órdenes de compra ✅ (detalle expandible, agregar comprobante, anular con reversión)
6. Formulario nueva orden de compra ✅
7. Formulario editar orden de compra ✅ (revierte y re-aplica stock/costos si era Confirmada)
8. Ventas POS ✅ — bloqueada sin caja abierta
9. Registro de ventas ✅ (filtros período + turno/medio/estado, filtrado en cliente)
10. Movimientos de stock — listado ✅
11. Movimientos de stock — nuevo ✅
12. Movimientos de stock — edición ✅
13. **Caja** — apertura, cierre, retiro, reapertura con auditoría ✅

---

## 8. Campos verificados en BD (referencia rápida)

- `tasas_iva`: campo es `nombre`, NO `descripcion`
- `movimientos`: usa `fecha_utc` (DATE), `categoria_gasto_id`, `medio_pago_id`; `cuenta_id` nullable
- `movimientos.anulado`: BOOLEAN DEFAULT false — agregado sesión 10
- `movimientos.fecha_utc`: tipo DATE (sin hora)
- `movimientos.mes_contable`: tipo DATE, formato YYYY-MM-01
- `ventas.fecha_utc`: tipo DATE (sin hora)
- `movimientos_stock.fecha_utc`: tipo DATE (sin hora)
- `retiros_caja.fecha_utc`: tipo DATE (sin hora)
- `ordenes_compra`: usa `fecha_orden`, `estado_orden_compra_id` (FK), `numero_factura_proveedor`, `flete_transportista_id` (agregado sesión 10)
- `ordenes_compra.flete_transportista_id`: BIGINT NULL FK → transportistas(id) — agregado sesión 10
- `proveedores`: usa `nombre_comercial`, no `nombre`
- `categorias_gasto`: NO tiene campo `activo`; SÍ tiene campo `tipo`
- `conceptos_gasto`: tiene campo `tipo`
- `usuarios`: campos son `nombre` + `apellido` separados; `id` es UUID; `sucursal_id` = 1 para ambos
- `medios_pago`: 4 medios genéricos (Efectivo=1, Débito=2, Crédito=3, Transferencia=4)
- `articulo_stock`: usa `stock_min` y `stock_max` (NO stock_minimo/stock_maximo)
- `cierres_turno`: usa `estado_cierre_turno_id` (1=Abierto, 2=Cerrado sin diferencia, 3=Cerrado con diferencia)
- `retiros_caja`: usa `cierre_turno_id` + `concepto`
- `turnos`: 1=Mañana, 2=Tarde (General eliminado)
- `orden_compra_items`: NO tiene campo `descuento_pct`
- `transportistas`: tabla nueva (id, nombre, activo) — Andreani, Correo Argentino, VIA CARGO + particulares
- `historico_precios`: tabla nueva (id, articulo_id, fecha, tipo, costo_sin_iva, precio_local, precio_web, precio_mayorista, precio_oferta_web, tasa_iva_id, origen_id, usuario_id, creado_en)

---

## 9. Sesión 10 — Módulo Compras completo + mejoras transversales

### Módulo Compras
- **Nueva orden**: proveedores por `nombre_comercial`, medios de pago genéricos, búsqueda tokenizada de artículos (ej: "creat ena"), navegación ↑↓+Enter, foco en Cant.Fact. al agregar, Cant.Recib. sigue a Cant.Fact. por defecto
- **Precio ingresado con IVA incluido**: el sistema divide por tasa del artículo antes de persistir `precio_unitario_sin_iva` y `costo_sin_iva`
- **Flete**: campo transportista (tabla `transportistas`), distribuir en artículos (checkbox, default ON), columna "Costo c/flete" informativa en tabla, dos movimientos separados (compra + flete)
- **Al confirmar**: actualiza `costo_sin_iva` en `articulos` + inserta en `historico_precios` (tipo='costo')
- **Editar orden**: carga datos existentes, si era Confirmada revierte stock/costos/movimientos antes de re-aplicar
- **Anular orden**: revierte stock, restaura costo anterior desde `historico_precios`, marca movimientos como `anulado=true`
- **Listado**: detalle expandible con items, columnas Compra/Flete/Total, agregar comprobante modal, botones Editar/Anular

### Artículos
- Columna Stock en listado (desde `articulo_stock` con query separada + merge por Map)
- Filtro Disponibilidad (local/web/todos, default=local)
- Filtro Stock (con stock / sin stock / todos)
- RLS agregada a `articulo_stock`

### Registro de Ventas
- Reescrito con filtrado en cliente (igual que Movimientos) — elimina race conditions
- Filtro de fechas muestra rango calculado en modo Día/Mes/Año

### Nuevas tablas en BD
- `transportistas` (id, nombre, activo) — con RLS
- `historico_precios` (snapshot completo de precios por evento)
- `movimientos.anulado` BOOLEAN DEFAULT false
- `ordenes_compra.flete_transportista_id` FK → transportistas

### Políticas RLS agregadas
- `articulo_stock`: SELECT
- `ordenes_compra`: SELECT, INSERT, UPDATE
- `orden_compra_items`: SELECT, INSERT, DELETE
- `historico_precios`: SELECT, INSERT
- `transportistas`: SELECT

### Correcciones UI transversales
- Todos los inputs de monto: `type="text" inputMode="numeric"` (eliminado `type="number"` para montos)
- `ArticuloForm.tsx`: 7 campos de precios/costos corregidos; `valueAsNumber` → `setValueAs` con parseo manual
- `CarritoItems.tsx`: descuento % corregido
- `PanelPagos.tsx`: descuento y monto pago corregidos
- Notificaciones de error con diseño del sistema (reemplaza `alert()`) en Compras
- Separador de miles en todos los campos de monto

### Datos de prueba cargados (sandbox)
- 34 Proteínas + 17 Creatinas = 51 artículos
- rubro_id: Proteínas=1, Creatinas=2
- marca_id: ENA=1, Star Nutrition=2, Gold Nutrition=3, Nutremax=4, One Fit=6, Body Advance=9
- 17 registros de stock inicial en `articulo_stock`
- 1 orden de compra confirmada (id=3, Black Suplementos, $408.547,92)

### Menú lateral — orden actual
1. Dashboard, 2. Caja, 3. Ventas, 4. Registro Ventas, 5. Movimientos, 6. Stock, 7. Compras, 8. Artículos, 9. Reportes, 10. Configuración

### Próximos pasos (en orden)
1. **Dashboard** ← inmediato
2. Indicador rentabilidad caída en Artículos
3. Reportes
4. Migrar datos históricos

---

*Este archivo se actualiza al cierre de cada sesión. No re-relevar información ya confirmada.*

---

## 10. Sesión 14 (29-30/06/2026) — Producción en vivo + unificación sandbox/producción

### Entrada en producción real
- 29/06/2026: primera jornada operativa completa con Agustín. 9-10 ventas reales, $278.150 total.
- Plan de corte: 01/07 paralelo con Cover → 06/07 exclusivo sistema propio → 12/07 baja Cover.

### Bug crítico encontrado y resuelto: ledger de Movimientos no se generaba en Ventas
- **Causa:** `api/ventas/route.ts` insertaba en `movimientos` con `concepto_gasto_id: null`, pero la columna es `NOT NULL`. El insert fallaba y el error se silenciaba (`console.error`), dejando la venta confirmada pero sin su contrapartida en el ledger.
- **Fix:** `concepto_gasto_id: 35` ("Venta local", ligado a `categoria_gasto_id: 10` "Ventas").
- **Backfill ejecutado en producción:** 10 movimientos generados retroactivamente para las ventas del 29/06. Se detectó y corrigió un movimiento espurio generado para una venta Anulada (#1312, $27.000) — el backfill inicial no excluía `estado_venta_id=3`.
- **Bug relacionado corregido:** el flujo de anulación de venta (`ventas/registro/page.tsx`, función `anularVenta`) revertía stock pero nunca eliminaba el movimiento asociado. Se agregó `DELETE` sobre `movimientos` por `origen_tipo='venta'` + `origen_id`.
- **Pendiente identificado, no bloqueante:** la anulación de ventas se hace vía Client Component con UPDATE/DELETE directo (RLS), sin pasar por un API route con reglas de negocio — a diferencia de Compras, que sí tiene flujo de anulación server-side. Evaluar migrar en MVP v2, especialmente si se agrega regla de Nota de Crédito para ventas ya fiscalizadas.

### Tarea 3 — Unificación sandbox/producción ✅ COMPLETADA

Diagnóstico completo vía SELECT cruzados entre ambos entornos. Divergencias identificadas y resueltas:

**Aplicado en producción (`unificacion_01.sql`):**
- Funciones `reabrir_ultimo_cierre`, `fn_aplicar_item_stock` (+ trigger sobre `movimiento_stock_items`), `revertir_movimiento_stock`
- Tabla `reaperturas_caja`: producción tenía estructura jsonb sin uso real (reapertura nunca se probó en producción); se adoptó la estructura de columnas individuales de sandbox.
- **Trigger de stock duplicado resuelto:** producción tenía DOS mecanismos de actualización de `articulo_stock` coexistiendo — uno viejo (`fn_aplicar_movimiento_stock_confirmado`, sobre cabecera `movimientos_stock`, modelo de transferencias entre sucursales nunca usado) y uno vigente (vía `movimiento_stock_items`). Se confirmó con SELECT que el trigger viejo nunca aplicó cambios reales (0 filas con `cantidad` no-null bajo ese modelo). Se hizo `DROP TRIGGER` + `DROP FUNCTION` del mecanismo viejo. Producción queda alineada al modelo cabecera + items, igual que sandbox.

**Aplicado en sandbox (`unificacion_02_sandbox.sql`):**
- `medios_pago` id=5 = QR Mercado Pago
- `estados_venta` id=4 = Fiscalizada
- Columna `ventas.mes_contable` (completada retroactivamente para ventas existentes)

**Verificación final (30/06/2026) — 7/7 checks OK:**
- Sandbox: medios_pago (5 filas), estados_venta (4 filas), 0 ventas con mes_contable null
- Producción: 3 funciones nuevas presentes, trigger viejo eliminado, trigger nuevo activo sobre `movimiento_stock_items`, `reaperturas_caja` con estructura de columnas

**Pendiente sesión futura (no bloqueante):** evaluar `DROP COLUMN articulo_id, cantidad, sucursal_destino_id` en `movimientos_stock` (cabecera) de producción — quedan obsoletas y siempre NULL bajo el modelo vigente, una vez confirmado que ningún código las referencia.

### Próximos pasos (en orden)
1. Conteo físico de stock (Ariel, 30/06) → Excel → `UPDATE articulo_stock` en producción
2. Borrar datos de prueba de producción (cierres de turno y movimientos de prueba previos al 29/06)
3. Actualizar `HABITUS_SD_PRODUCCION_COMPLETO.sql` consolidando todos los cambios de la sesión
4. Evaluar limpieza de columnas obsoletas en `movimientos_stock`
