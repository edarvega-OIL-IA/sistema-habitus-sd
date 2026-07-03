# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 03/07/2026 — Sesión larga (02-03/07): bug crítico de stock en Ventas (nunca descontaba desde el arranque) + causa raíz real (permisos GRANT faltantes, no solo RLS) + auditoría completa del esquema + diseño de corrección de ventas mal cargadas (Caso A/B)
**Estado general:** 🟢 Sistema en producción real. Bug de stock en Ventas resuelto y validado end-to-end (carga + anulación). Fixes de decimales en Compras/Artículos/Movimientos aplicados. Ventas de prueba limpiadas, numeración realineada a 1334.
**Próxima acción concreta:** Construir pantalla "Editar ítems" (Caso A: corregir artículo/cantidad en venta Guardada, mismo turno) en ruta `/ventas/registro/[id]`. Pendiente sin fecha: pantalla "Correcciones" para admin (turnos cerrados).

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `supabase/01_referencia.sql` ✅ al `supabase/08_cierre_turno.sql` ✅ — todos ejecutados
- `supabase/agregar_origen_subtipo.sql` — ejecutado en producción, PENDIENTE en sandbox
- `supabase/limpieza_arranque.sql` — ejecutado en producción (01/07)

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
| Facturación AFIP | Pendiente definir — candidato: TusFacturasAPP (Facturama descartado, es mexicano) |
| Pagos (MVP v2) | Mercado Pago (webhooks) |
| Tipografía sistema | Inter (Google Fonts) — reemplaza Geist |
| Modo offline | No contemplado |

---

## 4. Módulos confirmados (orden de prioridad)

1. Artículos / Inventario ✅
2. Órdenes de Compra ✅ (nueva, editar, listado con detalle)
3. Movimientos de Stock ✅ (incluyendo edición; excluye ventas/compras — solo movimientos manuales)
4. Ventas (carrito, modo POS, multi-pago) ✅ — descuenta stock correctamente (fix 02-03/07)
5. Registro de Ventas ✅ (anulación segura con reversión trazable, gateada por turno activo)
6. Movimientos financieros (ledger único) ✅
7. **Caja** (ex Cierre de turno) ✅
8. **Dashboard** ✅
9. Reportes — pendiente
10. Facturación AFIP automática — pendiente (ver sección 12)
11. Vitrina web propia (reemplaza Empretienda) — post-MVP
12. Team Habitus (sponsoreo a deportistas, a costo) — post-MVP

---

## 5. Infraestructura Supabase

- Organización: **Camino Doce Doce - IT**
- **Producción:** habitus-sd-production (ref: lfscdxrhwjpkkirxzhwt, AWS sa-east-1, Pro ~USD25/mes) — en uso real desde 29/06/2026
- **Sandbox:** habitus-sd-sandbox (AWS sa-east-1, plan Free) — usado para pruebas, con drift periódico respecto a producción
- `.env.local` → producción | `.env.development.local` → sandbox
- **Deploy:** https://sistema-habitus-sd.vercel.app (GitHub, auto-deploy en push)

---

## 6. Decisiones pendientes

- [ ] Pantalla "Editar ítems" (Caso A) en `/ventas/registro/[id]` — corregir artículo/cantidad de una venta Guardada, mismo turno del cajero
- [ ] Pantalla "Correcciones" (admin, rol_id=1) para ventas de turnos ya cerrados — usa columnas `corregido_por_usuario_id`, `corregido_en`, `motivo_correccion` (ya en producción)
- [ ] Circuito de Nota de Crédito (Caso B: venta ya fiscalizada con diferencia de dinero) — depende de tener fiscalización real activa
- [ ] Auditar el resto de tablas con triggers `SECURITY DEFINER=false` por el mismo patrón de GRANT faltante (ver sección 14) — auditoría inicial ya hecha, resultado limpio salvo `orden_compra_items` (corregido)
- [ ] Limpiar políticas RLS duplicadas restantes si aparecen nuevas (ya se limpiaron `movimientos_stock` y `venta_items`)
- [ ] Tipografías web: licenciar Antique Olive Nord D + Futura MD BT, o alternativas Google Fonts
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI (los demás módulos ya lo tienen)
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2 filas amarillas: −$28.000 del 30/06/2026)
- [ ] Pantalla de ABM de Categorías y Conceptos de movimientos (post-MVP)
- [ ] Reorganización del menú lateral (post-MVP)
- [ ] Editar historial de cierres de caja (Admin, pantalla separada) — post-MVP
- [ ] Indicador de rentabilidad caída en listado de artículos (rojo si margen bajó >5% desde última compra)
- [ ] Pantalla masiva de actualización de precios (aumentar % por rubro/marca)
- [ ] Sandbox sigue sin los cambios de Compras de sesión 15 y sin las tablas/columnas nuevas de esta sesión
- [ ] Borrar `src/app/(sistema)/diagnostico/` (herramienta temporal del bug del scanner, ya resuelto) una vez confirmado que no hace falta más
- [ ] MVP v2: fiscalización AFIP/ARCA vía TusFacturasAPP (cuenta todavía no creada) — Facturama descartado, es mexicano

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
- `movimientos.origen_subtipo`: TEXT — `'mercaderia'` | `'flete'` (agregado sesión 15, reemplaza distinción por texto en observaciones)
- `ordenes_compra.flete_fecha`: DATE — fecha real de pago del flete, separada de `fecha_orden` (agregado sesión 15)
- `ordenes_compra.monto_comprobante`: NUMERIC(12,2) — total según comprobante del proveedor (agregado sesión 15)
- `ordenes_compra.medio_pago_id`: INTEGER FK medios_pago — medio de pago de la mercadería (agregado sesión 15)
- `orden_compra_items.articulo_id`: nullable (agregado sesión 15, era NOT NULL) — permite ítem de ajuste por redondeo
- `orden_compra_items.es_ajuste_redondeo`: BOOLEAN DEFAULT false (agregado sesión 15)
- `ventas.corregido_por_usuario_id`: UUID NULL FK → usuarios(id) — agregado sesión 03/07, preparado para pantalla "Correcciones"
- `ventas.corregido_en`: TIMESTAMPTZ NULL — agregado sesión 03/07
- `ventas.motivo_correccion`: TEXT NULL — agregado sesión 03/07
- `movimientos_stock`: tiene columnas `articulo_id` y `cantidad` a nivel cabecera, pero están **obsoletas y siempre NULL** bajo el modelo vigente (cabecera + `movimiento_stock_items`) — no usar, candidatas a `DROP` en el futuro
- **IMPORTANTE:** política RLS permisiva ≠ permiso de tabla (GRANT). Antes de asumir que una tabla está bien protegida, verificar AMBAS cosas por separado — ver sección 14 para el caso real que esto causó

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

### Próximos pasos (en orden) — al cierre de sesión 14
1. Conteo físico de stock (Ariel, 30/06) → Excel → `UPDATE articulo_stock` en producción
2. Borrar datos de prueba de producción (cierres de turno y movimientos de prueba previos al 29/06)
3. Actualizar `HABITUS_SD_PRODUCCION_COMPLETO.sql` consolidando todos los cambios de la sesión
4. Evaluar limpieza de columnas obsoletas en `movimientos_stock`

---

## 11. Sesión 15 (30/06/2026) — Compras reescrito + stock inicial cargado + arranque operación paralela

### Contexto de la sesión
Ariel hizo un pedido real a Disfit por $485.456,03 (transferencia), pagado el mismo día del pedido, con flete a pagar recién cuando llegue la mercadería. Este caso de uso expuso que el sistema solo generaba el movimiento financiero de una Orden de Compra al **Confirmar**, nunca al **Guardar como Borrador** — dejando la caja real desalineada del sistema durante todo el tiempo que la mercadería está en tránsito.

### Decisión de diseño acordada con Ariel
> "Cuando cargo la OC (Borrador o Confirmada) se debe generar el movimiento de pago. Cuando se confirma la OC se actualiza el stock y se genera movimiento del flete (si existe)."

Reglas finales:
- El disparador de generar/actualizar un movimiento es **monto > 0** en cada campo (mercadería, flete), no el estado de la orden.
- El flete **nunca** se carga sin haber sido pagado (regla de negocio de Ariel: "lo cargo cuando lo pago").
- Si el monto baja a $0 en una edición → se permite eliminar el movimiento, pero pide confirmación explícita.
- Stock, costo y `historico_precios` se actualizan **solo al Confirmar**, nunca en Borrador.
- Si se agrega flete después de que la orden ya estaba Confirmada (flete era $0): se recalcula `costo_final_unitario` en `historico_precios` siempre; solo se pisa `articulos.costo_sin_iva` si esa orden es la compra más reciente del artículo (si hay compras posteriores del mismo artículo, no se debe corromper el costo actual — solo se corrige el histórico).

### Validación de monto contra comprobante — nueva funcionalidad
A raíz de una diferencia real de $0,05 entre el total calculado por el sistema (suma de ítems redondeados individualmente) y el total real de la factura del proveedor, se agregó:
- Campo **"Monto según comprobante"** en la sección "Tiene comprobante".
- Al guardar, el sistema compara `monto_comprobante` vs `subtotalArticulos`:
  - Diferencia **≥ $500** (umbral fijo, aprox. el costo del artículo más barato del catálogo — sugiere que falta cargar un ítem completo) → **bloquea el guardado** con mensaje explícito.
  - Diferencia **< $500** → aviso ámbar no bloqueante con dos opciones: **"Ajustar automáticamente"** (el movimiento de mercadería usa el monto del comprobante; se inserta un ítem `es_ajuste_redondeo=true` en `orden_compra_items` documentando la diferencia; el `total` de la orden queda igual al comprobante) o **"Corrijo yo manualmente"** (el usuario ajusta algún precio/cantidad y vuelve a intentar).
- Principio acordado con Ariel (background de 15 años en contabilidad de seguros): *"En movimientos de dinero tiene que ser el monto exacto del pago. En la orden de compra, si hay diferencia en la suma de los totales, se hace un registro de redondeo, y el total final de la OC debe coincidir con lo pagado."* — de ahí que el ajuste se registre como **ítem visible** en `orden_compra_items` (no como campo oculto en `ordenes_compra`), para que quede trazable en cualquier auditoría futura.

### Cambios en BD — producción (pendiente replicar en sandbox)

**Nuevas columnas:**
- `movimientos.origen_subtipo TEXT` — `'mercaderia'` | `'flete'`. Reemplaza la práctica anterior de distinguir movimientos de una misma orden por texto libre en `observaciones` (fue decisión explícita de Ariel: "Nunca con texto, agreguemos columna").
- `ordenes_compra.flete_fecha DATE` — fecha real de pago del flete, separada de `fecha_orden` (el flete se paga días después, al recibir la mercadería).
- `ordenes_compra.monto_comprobante NUMERIC(12,2)`.
- `ordenes_compra.medio_pago_id INTEGER FK medios_pago` — medio de pago de la mercadería (existía `flete_medio_pago_id` para el flete pero faltaba el de mercadería).
- `orden_compra_items.es_ajuste_redondeo BOOLEAN DEFAULT false`.

**Modificación de constraint:**
- `orden_compra_items.articulo_id` → cambiado a **nullable** (era `NOT NULL`) para permitir el ítem especial de ajuste por redondeo (sin artículo real asociado).

**RLS corregidas (bloqueaban silenciosamente el guardado de órdenes):**
- `ordenes_compra` tenía solo política SELECT — se agregaron INSERT y UPDATE.
- `orden_compra_items` tenía solo política SELECT — se agregaron INSERT, UPDATE y DELETE.

**Backfill:**
- Movimientos existentes de órdenes de compra clasificados en `origen_subtipo` según `concepto_gasto_id` (33→mercadería, 44→flete).

### Archivos reescritos (producción)
- `compras/nueva/page.tsx` — genera movimiento de mercadería y flete al guardar (Borrador o Confirmada), valida contra `monto_comprobante`, guarda `medio_pago_id`.
- `compras/[id]/page.tsx` — misma lógica + función `sincronizarMovimiento()` que crea/actualiza/elimina cada movimiento por `origen_subtipo` sin duplicar nunca; recalcula histórico de costo al agregar flete post-confirmación respetando la regla de "no pisar costo si hay compra más reciente".
- `compras/page.tsx` — listado: muestra el ítem de ajuste por redondeo como fila ámbar diferenciada ("Ajuste por redondeo") en el detalle expandido de cada orden.

### Bug de proceso detectado y corregido durante la sesión
Al copiar los archivos entregados, el contenido de `compras/[id]/page.tsx` quedó pegado por error en `compras/nueva/page.tsx` (mismo nombre `page.tsx` en ambas carpetas generó la confusión). Síntoma: título "Editar orden de compra #NaN" al intentar crear una orden nueva, y la orden nunca se guardaba. Se corrigió re-entregando los archivos con nombres de descarga bien diferenciados (`PARA_CARPETA_nueva.tsx` / `PARA_CARPETA_id_corchetes.tsx`) para futuras entregas de archivos que compartan el mismo nombre final.

### Orden real cargada en producción
- **Orden #2** — Disfit, 30/06/2026, Borrador, Transferencia, 5 artículos (Omega 3, Creatina Neutro, Creatina Fruit Punch, Magnesium Mega, Glicinato de Magnesio).
- Comprobante N°00230000, monto $485.456,03. Diferencia de $0,05 contra la suma de ítems → resuelta con "Ajustar automáticamente".
- Movimiento id=28: Egreso $485.456,03, fecha 30/06, Transferencia, `origen_subtipo='mercaderia'`, `origen_id=2`.
- **Pendiente:** cuando llegue la mercadería, editar la orden, cargar flete_monto + flete_fecha + transportista, y Confirmar (dispara actualización de stock y costos de los 5 artículos).

### Stock inicial ajustado (conteo físico 30/06)
- Excel `Habitus_Conteo_Stock_20260630_EAV.xlsx` — 126 artículos contados, 65 con diferencia entre stock sistema y stock real.
- Script `stock_ajuste_final.sql` ejecutado en producción: 65 `UPDATE articulo_stock` directos (sin movimientos de ajuste — decisión de Ariel, ya que los datos de movimientos/caja de junio se van a borrar antes del arranque del 01/07).
- Reporte de diferencias por rubro entregado (mayor faltante neto: Barras de proteína -69 unidades, Geles -27, Geles Cafeína -5).
- Casos especiales:
  - id=1071 (Nitrogain Frutilla Xtrenght): vencido → `stock=0` + `disponible_local=false`.
  - id=964 (Hydromax Doypack 1320Gr Manzana) e id=1256 (Classic Whey Protein Vainilla One Fit): artículos que ya existían en catálogo con `disponible_local=false` — activados a `true` con stock inicial.
  - id=1049 (Creatina Monohidrato 300G Dp Neutra Star Nutrition): ajustado a mano restando 1 unidad sobre lo que decía el conteo, por una venta ocurrida después del conteo físico.
- **Pendiente:** Ariel va a re-controlar personalmente varios artículos con lecturas dudosas de la planilla manual antes de dar el conteo por definitivo (algunas cifras del papel fueron difíciles de leer a distancia en fotos).

### Arranque de operación paralela
- 01/07/2026: inicio oficial del uso simultáneo del sistema propio + Cover.
- Objetivo uso exclusivo del sistema propio: 06/07/2026.
- Objetivo baja de Cover: 12/07/2026.

### Próximos pasos (en orden)
1. Control físico de stock por Ariel (turno mañana 01/07) — validar casos dudosos del conteo del 30/06.
2. Limpiar movimientos y datos de caja de junio en producción (arranque limpio del 01/07).
3. Ejecutar `agregar_origen_subtipo.sql` en sandbox (ya aplicado en producción) — agrega `origen_subtipo`, `flete_fecha`, `monto_comprobante`.
4. Replicar manualmente en sandbox los tres archivos de Compras reescritos (sandbox no tiene API routes para este módulo, es Client Component directo a Supabase, igual que Ventas).
5. MVP v2 (sin fecha): modificar ventas Guardadas, Nota de Crédito, fiscalización AFIP/ARCA vía TusFacturasAPP (Facturama descartado — es una plataforma mexicana, no sirve para Argentina; ver sección 12).

---

## 12. Fiscalización AFIP/ARCA — corrección de proveedor y estado de la investigación (01/07/2026)

### Corrección crítica
Todo el análisis funcional original (`HABITUS_SD_ANALISIS_SESION01.md`, sección 41) diseñó la máquina de estados de fiscalización asumiendo **Facturama** como proveedor. Se confirmó que **Facturama es una plataforma exclusivamente mexicana** (CFDI/SAT México) — nunca tuvo integración con AFIP/ARCA. El diseño de datos (tabla `comprobantes` separada de `ventas`, estados asíncronos, log de intentos con respuesta cruda) sigue siendo válido tal cual está documentado — solo cambia el nombre del proveedor en cada mención.

### Bug relacionado detectado en producción
El INSERT a `comprobantes` en `api/ventas/route.ts` falla silenciosamente: la tabla tiene `numero BIGINT NOT NULL` pero el código no lo incluye en el insert. Consecuencia: toda venta marcada "Fiscalizar" queda con `ventas.estado_venta_id=1` ("Pendiente fiscal") pero **sin ninguna fila en `comprobantes`** — no hay rastro del intento. No se corrige todavía porque depende de la decisión de proveedor real (no tiene sentido generar un número de comprobante "fantasma" sin CAE detrás). **Mientras tanto: seguir emitiendo la factura real desde Cover durante el período paralelo**, y en el sistema propio guardar esas ventas como "Guardada" (sin tocar el checkbox Fiscalizar) para no acumular ventas en estado pendiente sin salida.

### Proveedor candidato: TusFacturasAPP
- API REST, homologada por AFIP/ARCA desde 2015 (servicio WSFEv1), soporta tipos A/B/C/M/E + Factura de crédito electrónica
- Prueba gratis: 30 días / 5 comprobantes de cualquier tipo
- **Certificado:** TusFacturasAPP genera su propio certificado de enlace (no reutiliza el certificado que ya usa Cover). El enlace lo hace Ariel mismo con su CUIT + Clave Fiscal en el sitio de ARCA, siguiendo un instructivo que llega por mail — no más de 10 minutos.
- **Convivencia con Cover confirmada:** ARCA permite delegar el mismo Web Service (WSFEv1) a varios sistemas autorizados en simultáneo. Cover puede seguir facturando sin interrupción mientras se prueba/activa TusFacturasAPP en paralelo.
- **Pendiente de revisar:** el plan de API tiene precios separados del plan de uso manual vía su interfaz web (ver developers.tusfacturas.app → Planes API) — confirmar costo real antes de comprometerse.
- Alternativas evaluadas: Afip SDK (librería que abstrae WSFEv1 sin intermediario de facturación), WSFEv1 directo (sin costo de plataforma, pero requiere manejar certificados/WSAA/SOAP por cuenta propia).

### Estado de la decisión
- Ariel: régimen Monotributista, emite exclusivamente Factura C — sin ambigüedad de tipo de comprobante (ya estaba anotado en el análisis original, sección 41, Decisión 5).
- Certificado/Clave Fiscal ante ARCA: ya existe (el mismo que usa con Cover), no requiere trámite nuevo — solo el enlace específico con el proveedor que se elija.
- Cuenta en TusFacturasAPP: todavía no creada — pendiente que Ariel revise el plan de API y decida si arranca la prueba gratuita.
- Estados async confirmados (ya diseñados en el análisis original): Pendiente → Enviado → CAE_Recibido (equivale a "Fiscalizado" en Cover) → CAE_Rechazado / Reintentando.

### Próximos pasos
1. Ariel revisa planes de API de TusFacturasAPP y decide si crea la cuenta de prueba.
2. Una vez creada la cuenta y hecho el enlace con ARCA, generar credenciales de API y arrancar la integración real (tabla `comprobantes`, `intentos_fiscalizacion`, fix del campo `numero` faltante).
3. Hasta entonces: toda factura real sigue saliendo de Cover; el sistema propio no debe usarse para fiscalizar.

---

## 13. Sesión 16 (01/07/2026) — Primer día real, limpieza total y correcciones de arranque

### Limpieza completa para arranque limpio
Se ejecutó `limpieza_arranque.sql` en producción: se borraron todas las ventas, movimientos, la orden de compra de prueba, y 6 cierres de turno de prueba (id 5-10), dejando **solo el cierre de turno del día de hoy** (id=11, apertura $5.350). También se limpiaron `movimientos_stock` de prueba (26-27/06) que la limpieza inicial no había alcanzado. Numeración alineada manualmente con los últimos números reales de Cover: `numeracion_ventas.ultimo_numero=1313`, `numeracion_comprobantes.ultimo_numero=393`.

**Aprendizaje:** el número de venta interno (`numero_venta`, incrementado por cada venta sin distinguir Guardada/Fiscalizada) nunca va a coincidir con el contador "Guardado" de Cover (que es independiente del contador "Fiscalizado") — son lógicas de numeración distintas por diseño, no un bug. Lo que sí importa que coincida es `numeracion_comprobantes`, que es el número fiscal real.

### Corrección de stock — segunda pasada (columna "Ariel")
El Excel de conteo recibió una columna adicional (`I: Ariel`) con la revisión personal del dueño sobre casos dudosos. Comparado contra el estado ya corregido en producción (no contra la columna "Stock Sistema" original, que ya estaba desactualizada), solo 4 artículos necesitaron un ajuste más: id=903, 922, 978, 980.

### Bug: "Esperado en caja" duplicaba ventas en efectivo
En `cierre-turno/page.tsx`, los widgets "Ventas efectivo" (desde `venta_pagos`) e "Ingresos efectivo" (desde `movimientos`) contaban la misma venta dos veces, porque toda venta genera automáticamente un movimiento de ingreso además de su registro de pago. Fix: "Ingresos efectivo" ahora excluye movimientos con `origen_tipo='venta'` (esos ya están contados en "Ventas efectivo"); solo debe mostrar ingresos de caja que no provengan de una venta.

### Bug: scanner de código de barras duplicaba lecturas
En `BuscadorProductos.tsx` (Ventas), un lector de código de barras que "rebota" (dispara la misma lectura dos veces por hardware) producía dos síntomas: productos duplicados en el carrito, o el código de barras completo terminando como cantidad (porque el popup de cantidad es un input numérico enfocado, y los dígitos del segundo escaneo caían ahí). Fix de dos partes:
1. **Anti-rebote:** si el mismo texto se procesa dos veces en menos de 400ms, la segunda se ignora.
2. **Blindaje del campo Cantidad:** mientras el popup está abierto, caracteres que llegan a velocidad de lector (menos de 30ms entre uno y otro) se bloquean para que no toquen el campo numérico visible, y solo se acumulan para detectar "este es el siguiente producto".

Aprovechando el cambio, el buscador de Ventas pasó de consultar Supabase por cada tecla (async, con latencia de red) a cargar el catálogo completo una sola vez al entrar a la pantalla y filtrar en memoria — mismo patrón que ya usa Compras. Esto también eliminó de raíz una fuente de resultados "viejos" pisando a los más nuevos.

### Búsqueda tokenizada y sin acentos — Artículos y Ventas
Se aplicó el mismo patrón de búsqueda que ya tenía Compras (`creat ena` encuentra "Creatina... ENA") a las pantallas de Artículos y Ventas: cada palabra escrita se busca por separado sin importar el orden, y se ignoran tildes/mayúsculas. En Artículos, el texto buscable ahora también incluye rubro y marca.
**Nota:** esto no resuelve búsquedas en idiomas distintos al del catálogo — ej. "proteina" (español) no encuentra "Protein" (como está cargado en inglés en el nombre del producto); son palabras distintas, no un problema de acentos.

### RLS corregidas (bloqueaban guardado silenciosamente)
- `ordenes_compra`: solo tenía SELECT — agregadas INSERT y UPDATE.
- `orden_compra_items`: solo tenía SELECT — agregadas INSERT, UPDATE y DELETE.
- `ordenes_compra.medio_pago_id`: columna faltante agregada (el medio de pago de la mercadería no se estaba guardando ni cargando en el formulario de edición).

### Archivos modificados (producción)
- `cierre-turno/page.tsx` — fix duplicación Ingresos efectivo
- `dashboard/page.tsx` — mismo fix, banner de turno abierto
- `components/ventas/BuscadorProductos.tsx` — reescrito en 3 vueltas: anti-rebote → ventana deslizante → foco fijo en buscador (fix definitivo) + catálogo en memoria + búsqueda tokenizada
- `articulos/page.tsx` — búsqueda tokenizada sin acentos
- `diagnostico/page.tsx` — herramienta temporal de diagnóstico, pendiente borrar

### Pendientes al cierre de sesión 16
1. Probar mañana en el local: búsqueda en Ventas, fix de Caja, fix de scanner con uso real.
2. Ariel evalúa plan de API de TusFacturasAPP.
3. Sandbox sigue sin los cambios de Compras de sesión 15 (pendiente desde ayer).
4. Fix del campo `numero` faltante en `comprobantes` — pospuesto hasta definir proveedor de fiscalización real.

### Bug: "Esperado en caja" duplicado también en el Dashboard
El mismo bug de duplicación de ventas en efectivo (ver arriba) estaba replicado de forma independiente en `dashboard/page.tsx` — el banner de turno abierto mostraba un monto distinto al de la pantalla de Caja ($278.350 vs $153.350 en el caso real detectado). Mismo fix: excluir `origen_tipo='venta'` al sumar ingresos.

### Corrección de datos: venta #1326 (comprobante Cover C0003-00000401)
Un control cruzado contra el listado detallado de Cover detectó 3 errores de carga en una venta de 50 artículos: un sabor equivocado (Cupcake Keto Chocolate cargado en vez de Vainilla), una cantidad mal cargada (Banana Split ENA: 4 en vez de 2), y un ítem completo faltante (Barra Frutillas a la Crema ENA, 2 unidades). El total de la venta coincidía por pura casualidad (los errores se compensaban en unidades totales), lo que ocultaba el problema a simple vista. Se corrigió con SQL transaccional: ajuste de `venta_items` + ajuste relativo de `articulo_stock` en los 4 artículos afectados (no absoluto, para no pisar movimientos de stock posteriores). El descuento de cabecera (8,38%) no requirió tocarse porque el efecto neto sobre el subtotal fue $0.
**Aprendizaje:** Cover reparte el descuento de una venta prorrateándolo en cada línea (precio unitario ya con descuento aplicado); nuestro sistema lo guarda como un único `descuento_pct` sobre el total de la cabecera. Ambos son válidos y dan el mismo total final — no es un bug, hay que tenerlo en cuenta al comparar precios unitarios entre los dos sistemas.

### Bug del scanner — historia completa de la sesión (3 vueltas hasta la causa real)
El bug de cantidades erráticas al escanear resultó tener **dos causas distintas superpuestas**, resueltas en pasos sucesivos:

1. **Primera vuelta:** anti-rebote con ventana fija de 400ms — insuficiente.
2. **Segunda vuelta:** se sospechó "modo de lectura continua" del hardware (el lector sigue mandando el código mientras el gatillo está apretado). Se subió el umbral a 1.200ms y se cambió a ventana deslizante (se reinicia mientras sigan llegando lecturas del mismo código, solo se libera con silencio real). Mejora parcial, pero el síntoma persistía con patrones raros (cantidades tipo 5, 5, 8).
3. **Diagnóstico con herramienta dedicada:** se creó una página temporal (`/diagnostico`) que registra cada `Enter` recibido con su timestamp exacto, sin ninguna lógica de negocio de por medio. Confirmó el patrón real: **una sola pasada del lector transmite el código completo dos veces, separadas por ~150ms** — no rebote de milisegundos aislado, no lectura continua indefinida.
4. **Causa raíz real encontrada:** al abrir el popup de cantidad, el foco del teclado saltaba del buscador a ese campo. Esa transición no es instantánea (depende del ciclo de render de React) — si la segunda transmisión del lector llegaba justo en esa ventana de transición, caía en tierra de nadie entre dos piezas de lógica distintas (una para el buscador, otra para el popup), cada una con su propia protección, ninguna cubriendo el caso de foco "en tránsito". Era una condición de carrera (race condition), no un problema de calibración de umbrales.
5. **Fix definitivo:** el foco del teclado **nunca se mueve automáticamente** al campo de cantidad — se queda siempre en el buscador principal, sea cual sea el estado del popup. El campo de cantidad pasa a ser una pantalla (display) que solo se vuelve editable si el cajero hace clic ahí con el mouse (intención real, algo que un lector de código nunca puede disparar). Sumado a un chequeo extra: si hay un popup abierto y llega el mismo código de barras/interno de ese artículo, se ignora sin importar cuánto tiempo pasó.

Verificado con el lector real en el local: 3 escaneos de productos distintos, cada uno quedó en cantidad 1 correctamente.

**Pendiente:** borrar la carpeta `src/app/(sistema)/diagnostico/` (herramienta temporal, ya cumplió su función) una vez que el uso real de mañana confirme que el fix es estable.

---

## 14. Sesión 02-03/07/2026 — Bug crítico de stock en Ventas, causa raíz real, y diseño de corrección de ventas

### Bug crítico: Ventas nunca descontaba stock
Detectado por Ariel comparando stock esperado vs. real en un artículo puntual (id=982). Investigación reveló que `api/ventas/route.ts` nunca insertaba en `movimientos_stock`/`movimiento_stock_items` desde el arranque (29/06-01/07) — **ninguna venta había descontado stock**. Afectaba 15 ventas, 88 unidades.

**Fix aplicado:** se agregó a `route.ts` el bloque que inserta cabecera (`movimientos_stock`, tipo Egreso=2, `origen_tipo='venta'`, `origen_id=venta.id`) + detalle (`movimiento_stock_items`, uno por artículo), dejando que el trigger `fn_aplicar_item_stock` descuente `articulo_stock` automáticamente — mismo mecanismo que ya usa Compras. Backfill ejecutado para las 15 ventas afectadas.

### Causa raíz real (más profunda de lo que parecía al principio)
El primer backfill se hizo por SQL Editor de Supabase (bypasea RLS) y pareció funcionar, pero al confirmarse con una venta real desde la app, seguía sin descontar. Diagnóstico con consola del navegador (F12) reveló `permission denied for table articulo_stock` y `permission denied for table movimientos`.

**Explicación técnica:** el trigger `fn_aplicar_item_stock` tiene `prosecdef=false` (corre con los permisos del usuario real, no con privilegios elevados). Al intentar `UPDATE` sobre `articulo_stock`, chocaba con falta de **GRANT de tabla** (no de política RLS — la política de UPDATE existía y era permisiva, pero el permiso de tabla subyacente nunca se había otorgado; son dos cosas independientes en Postgres). Al fallar el trigger `AFTER INSERT`, **toda la transacción se revertía**, incluido el `INSERT` en `movimiento_stock_items` que la disparó — por eso las cabeceras de venta quedaban creadas pero sin items, dando falsa apariencia de éxito parcial.

**Fix aplicado (producción):**
```sql
GRANT INSERT, UPDATE, DELETE ON articulo_stock TO authenticated;
CREATE POLICY movimientos_delete ON movimientos FOR DELETE TO authenticated USING (true);
GRANT DELETE ON movimientos TO authenticated;
```
Backfill de items faltantes para ventas #1329-#1333 (cabeceras ya existían sin items) vía `INSERT ... WHERE NOT EXISTS`, dejando que el trigger (ya con permisos corregidos) descuente el stock real. Verificado con columna `actualizado_en` de `articulo_stock` (timestamp coincide con el backfill).

**Validado end-to-end en producción:** venta de prueba #1335 + anulación, sin errores de permisos — Egreso e Ingreso de reversión generados correctamente, stock correcto, movimiento financiero eliminado en la anulación.

### Lección clave para todo el proyecto
Verificar RLS ya no alcanza con revisar `pg_policies` — hay que verificar TAMBIÉN los GRANT reales de tabla vía `information_schema.role_table_grants` para el rol `authenticated`. Una política permisiva sin el GRANT subyacente da el mismo "permission denied" y es indistinguible sin este chequeo extra.

### Auditoría completa de GRANTs vs RLS (todo el esquema public)
Comparando `information_schema.role_table_grants` contra `pg_policies` para el rol `authenticated`, sobre 70+ combinaciones tabla+acción. Resultado: **un solo hallazgo real** — `orden_compra_items` tenía política de UPDATE (agregada en sesión 15) pero sin el GRANT correspondiente, mismo patrón. Nunca se había detectado porque la Orden #2 (Disfit) sigue en Borrador y nunca se editó un ítem existente en producción.

**Fix aplicado y verificado:** `GRANT UPDATE ON orden_compra_items TO authenticated;`

**Triggers `SECURITY DEFINER=false` revisados** (candidatos a este mismo problema): `fn_aplicar_item_stock` (ya cubierta), `fn_articulos_default_precio_web` (solo toca su propia fila, sin riesgo), `fn_validar_entidad_movimiento` / `fn_validar_origen_movimiento` (aparentemente solo `SELECT` de validación, sin riesgo aparente — no se confirmó definición exacta).

**Limpieza menor:** se encontraron y eliminaron 2 políticas RLS duplicadas (`select_all` en `movimientos_stock` y en `venta_items`, redundantes con políticas ya nombradas específicamente).

### Bug relacionado: `anularVenta` revertía stock sin trazabilidad
Al revisar el flujo de anulación (`ventas/registro/page.tsx`), se encontró que revertía `articulo_stock` con `UPDATE` directo, sin generar ningún `movimiento_stock` de reversión — rompía la trazabilidad reforzada por el fix principal. **Fix:** ahora inserta un movimiento de Ingreso compensatorio (mismo mecanismo de trigger), dejando ambos movimientos (Egreso original + Ingreso de reversión) visibles y auditables.

### Corrección de ventas mal cargadas — diseño acordado (Caso A/B)
A raíz de un caso real (venta #1326: se facturó un producto pero se entregó otro), se definió:
- **Caso A — venta Guardada (no fiscalizada):** se puede corregir por sistema. Diseño: pantalla "Editar ítems" en `/ventas/registro/[id]`, reemplaza ítem sin borrar el original (rastro de qué se cargó mal), genera movimiento de stock de reversión + nuevo descuento, recalcula total y muestra diferencia de cobro sin forzarla.
- **Caso B — venta ya fiscalizada (CAE recibido):** si no hay diferencia de dinero, alcanza con un ajuste de stock con nota (sin tocar la factura). Si hay diferencia de dinero, requiere Nota de Crédito + nueva Factura — depende de tener fiscalización real activa (TusFacturasAPP).

**Separación de roles para Editar/Anular en Registro Ventas:**
- Cajero, en el momento: solo ventas Guardadas de **su propio cierre de turno activo** (no turnos ya cerrados, no otro turno del mismo día).
- Admin, corrección posterior: pantalla separada "Correcciones" (no construida todavía), única con permiso de tocar ventas de cierres ya cerrados, con motivo obligatorio y rastro propio (columnas `corregido_por_usuario_id`, `corregido_en`, `motivo_correccion`, ya en producción) — para que nunca se vea igual que una edición normal del cajero.

**Implementado en `registro/page.tsx`:**
1. `anularVenta` corregida (revierte stock vía movimiento trazable, ver arriba).
2. Botón Anular gateado: solo visible si `estado_venta_id=2` (Guardada) **y** `cierre_turno_id` de la venta = cierre activo ahora (se agregó `cierreActivoId` al estado, antes solo se guardaba `turno_id`).
3. Columnas nuevas en `ventas` (producción, verificadas): `corregido_por_usuario_id`, `corregido_en`, `motivo_correccion` — preparadas para la pantalla de Correcciones, todavía sin UI.

**Pendiente (próxima etapa):** pantalla "Editar ítems" (Caso A) y pantalla "Correcciones" (admin) — ninguna de las dos está construida todavía, solo diseñadas y con la base de datos lista.

### Fix de decimales en inputs de monto (3 pantallas)
Bug repetido con causas distintas en cada pantalla: `Compras/nueva` (input controlado sin buffer de texto — la coma/punto se borraba al tipear), `ArticuloForm.tsx` (mezcla de `parseFloat` nativo que no entiende coma + regex vieja que trataba cualquier punto como separador de miles), `Movimientos/nuevo` (filtro que descartaba directamente cualquier carácter no numérico, diseñado solo para pesos enteros).

**Fix unificado:** función `parsearMonto` (coma o punto se interpreta como decimal si hay 1-2 dígitos después del separador, como separador de miles si hay 3) + buffer de texto en edición (muestra literalmente lo tipeado hasta perder el foco) + `inputMode="decimal"`. Mismo patrón aplicado en los 3 archivos. En `ArticuloForm.tsx` también se unificó el formato visual (antes mezclaba números crudos de JS con formato argentino en la misma pantalla).

**Pendiente:** auditar el resto de pantallas con inputs de monto por si tienen el mismo problema (no se hizo una revisión exhaustiva de todo el sistema, solo se corrigieron las 3 reportadas).

### Limpieza de ventas de prueba
Se usaron ventas de prueba (#1334, #1335) para validar el circuito de descuento/reversión de stock tras el fix de GRANTs. Se eliminaron completamente (venta, items, pagos, movimientos_stock, movimiento_stock_items) y se renumeró la venta real que había quedado como #1336 hacia #1334, retrocediendo `numeracion_ventas` a 1334, para no dejar huecos en la numeración interna. Confirmado que no se había entregado ningún comprobante con el número 1336 antes de renumerar (venta estaba Guardada, no fiscalizada). Próxima venta real numera 1335 automáticamente.

### Stock de Movimientos (pantalla `/stock`) — corrección de alcance
El fix principal de Ventas hizo que las ventas empezaran a aparecer en la pantalla de Movimientos de Stock, que estaba pensada exclusivamente para movimientos manuales (Consumo interno, Merma, Sponsoreo) — nunca para ventas ni compras. **Fix:** la pantalla ahora filtra `.is('origen_tipo', null)`, excluyendo automáticamente cualquier movimiento generado por Ventas o (en el futuro) Compras, sin necesidad de enumerar cada valor posible de `origen_tipo`. Se agregó también una traba defensiva (Editar/Eliminar deshabilitados si `origen_tipo` no es nulo) y se corrigió un bug de fecha (`new Date(fecha_utc)` corría un día para atrás por huso horario — reemplazado por `.split('-').reverse().join('/')`).

### Archivos modificados esta sesión (producción)
- `api/ventas/route.ts` — fix principal: genera movimiento de stock al confirmar venta
- `ventas/registro/page.tsx` — `anularVenta` con reversión trazable, gateo por turno+estado
- `compras/nueva/page.tsx` — fix decimales (`parsearMonto` + buffer de texto)
- `components/articulos/ArticuloForm.tsx` — fix decimales + unificación de formato visual
- `movimientos/nuevo/page.tsx` — fix decimales (reemplaza filtro de solo-enteros)
- `stock/page.tsx` — excluye ventas/compras, fix de fecha, traba defensiva

### Próximos pasos (en orden)
1. Pantalla "Editar ítems" (Caso A) en `/ventas/registro/[id]`.
2. Pantalla "Correcciones" (admin) para ventas de turnos cerrados.
3. Auditar el resto de pantallas con inputs de monto (no se revisó todo el sistema).
4. Replicar en sandbox todos los cambios de esta sesión (sigue desincronizado desde sesión 15).
5. Definir circuito de Nota de Crédito (Caso B) cuando la fiscalización esté activa.
