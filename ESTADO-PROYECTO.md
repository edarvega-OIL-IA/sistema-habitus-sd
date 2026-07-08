# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 08/07/2026 — Corrección de venta #1338 (artículo mal cargado), creación del estado `estados_venta.id=5 "Fiscalizado externamente"` y backfill de 19 ventas facturadas en Cover durante el período paralelo, `TODO` de "devolución a cliente" resuelto en `EditarItemsVentaModal.tsx`, `MAPA-ARCHIVOS.md` creado y agregado a la lista de documentos de referencia, fix de scroll en `BuscadorProductos.tsx`
**Estado general:** 🟢 Sistema en producción real. Módulo Compras estable. Pantalla "Editar ítems" (Caso A) 100% completa. Estado de ventas fiscales ahora distingue correctamente entre lo que factura el sistema propio y lo que se facturó por fuera (Cover u otro medio externo a futuro).
**Próxima acción concreta:** Pantalla "Correcciones" para admin (ventas de turnos cerrados) — sigue sin construir, base de datos lista y ya usada manualmente hoy como precedente (venta #1338). En paralelo: replicar en sandbox todos los cambios acumulados desde sesión 15 (Compras, Editar ítems, nuevo estado `Fiscalizado externamente`).

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `MAPA-ARCHIVOS.md` — índice de rutas: qué hace cada archivo .tsx/.ts del proyecto (creado 07/07, actualizar al cierre de cada sesión cuando cambien archivos)
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

- [ ] Pantalla "Correcciones" (admin, rol_id=1) para ventas de turnos ya cerrados — usa columnas `corregido_por_usuario_id`, `corregido_en`, `motivo_correccion` (ya en producción)
- [x] ~~`concepto_gasto_id` correcto para "Egreso por devolución a cliente"~~ — resuelto: `categorias_gasto` id=14 (Devoluciones), `conceptos_gasto` id=45 (Devolución a cliente)
- [ ] Circuito de Nota de Crédito (Caso B: venta ya fiscalizada con diferencia de dinero) — depende de tener fiscalización real activa
- [ ] Limpiar políticas RLS duplicadas restantes si aparecen nuevas (ya se limpiaron `movimientos_stock` y `venta_items`)
- [ ] Confirmar los 4 archivos marcados `[?]` en `MAPA-ARCHIVOS.md`: `configuracion/page.tsx`, `reportes/page.tsx`, `page.tsx` raíz, `lib/utils.ts`
- [ ] Borrar `compras/[id]/page_compras_id_old.tsx` (backup viejo, no forma parte del build) y `src/app/(sistema)/diagnostico/` (herramienta temporal del bug del scanner, ya resuelto) una vez confirmado que no hacen falta
- [ ] Tipografías web: licenciar Antique Olive Nord D + Futura MD BT, o alternativas Google Fonts
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI (los demás módulos ya lo tienen)
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2 filas amarillas: −$28.000 del 30/06/2026)
- [ ] Pantalla de ABM de Categorías y Conceptos de movimientos (post-MVP)
- [ ] Reorganización del menú lateral (post-MVP)
- [ ] Editar historial de cierres de caja (Admin, pantalla separada) — post-MVP
- [ ] Indicador de rentabilidad caída en listado de artículos (rojo si margen bajó >5% desde última compra)
- [ ] Pantalla masiva de actualización de precios (aumentar % por rubro/marca)
- [ ] Sandbox sigue sin los cambios de Compras de sesión 15 y sin las tablas/columnas nuevas de las sesiones siguientes; también validar ahí el fix de Emisor/Nro. de operación (pendiente #3, considerado resuelto sin testeo en producción)
- [ ] MVP v2: fiscalización AFIP/ARCA vía TusFacturasAPP (cuenta todavía no creada) — Facturama descartado, es mexicano
- [ ] Auditar el resto de pantallas con inputs de monto por si tienen el mismo problema de decimales (no se hizo una revisión exhaustiva de todo el sistema)

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
- `estados_venta`: **corrección sobre CLAUDE_CODE_PROMPT.md** — el nombre real en producción es `1=Fiscal` (NO "Pendiente fiscal" como estaba documentado), `2=Guardado` (NO "Guardada"), `3=Anulada`, `4=Fiscalizada`, `5=Fiscalizado externamente` (agregado sesión 08/07 — ver sección 17)
- `estados_venta`: la secuencia (`pg_get_serial_sequence`) puede desincronizarse del `MAX(id)` real si en algún momento se insertaron filas con `id` puesto a mano — verificar con `setval(pg_get_serial_sequence(...), (SELECT MAX(id) FROM tabla))` antes de un INSERT si da error de PK duplicada
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

---

## 15. Sesión 05/07/2026 — Pantalla "Editar ítems" (Caso A) completa y validada

### Componentes nuevos
- `src/components/ventas/EditarItemsVentaModal.tsx` — modal de edición de ítems de una venta Guardada.
- Botón "Editar" (ícono lápiz) agregado en `ventas/registro/page.tsx`, al lado de "Anular", mismo gateo: solo `estado_venta_id=2` y `cierre_turno_id` = cierre activo del cajero.

### Diseño de la edición
- No hay límite de ítems a editar por venta ni restricción de qué se puede tocar: artículo, cantidad y precio, todos editables.
- Mecánica: "eliminar línea + agregar línea nueva" (no swap in-place) — mismo criterio que ya usa Compras. Sin motivo obligatorio (esa exigencia es solo para la futura pantalla Correcciones de admin).
- Búsqueda de artículos tokenizada, mismo patrón que Compras/Artículos.

### Mecánica de stock — delta neto, no reversión total
Se calcula la diferencia neta por artículo entre el carrito original y el editado (no se revierte toda la venta y se vuelve a cargar entera). Genera un movimiento `Egreso` con los artículos que subieron/se agregaron y un movimiento `Ingreso` con los que bajaron/se sacaron — mismo mecanismo de trigger (`fn_aplicar_item_stock`) que ya usan Ventas y Compras. Validado con prueba real: venta con 2 artículos → editada agregando 1, sacando 1 y subiendo cantidad del tercero → deltas y stock final exactos en los 3 casos.

### Trazabilidad
Antes de reemplazar `venta_items`, se copia el estado actual a la nueva tabla `venta_items_historial` (snapshot con `editado_por_usuario_id`, `editado_en`). Se eligió esta tabla aparte (en vez de una columna `vigente` en `venta_items`) para no tener que auditar y tocar todas las consultas existentes del sistema (Stock, Reportes, Dashboard) que hoy leen `venta_items` sin filtro de vigencia — menor riesgo en un sistema ya en producción real.

**Permisos agregados (producción):**
```sql
CREATE POLICY venta_items_delete ON venta_items FOR DELETE TO authenticated USING (true);
GRANT DELETE ON venta_items TO authenticated;
CREATE TABLE venta_items_historial (...);
GRANT SELECT, INSERT ON venta_items_historial TO authenticated;
```

### Diferencia de cobro — dos vías, no mezcladas
Si el nuevo total difiere de lo ya cobrado, el modal ofrece dos caminos separados, decisión explícita de Ariel:

1. **Mover plata real** — "Cobrar ahora" / "Devolver ahora": inserta en `venta_pagos` + `movimientos` (ledger financiero), con selector de medio de pago, y Emisor + Nro. de operación replicados exactamente del patrón de `PanelPagos.tsx` (Ventas POS) — Emisor visible solo si el medio es Débito o Crédito.
2. **Ajuste contable puro, sin mover plata** — "No cobrar → descuento" / "No devolver → recargo": usa 2 columnas nuevas en `ventas` (`ajuste_edicion_monto NUMERIC`, `ajuste_edicion_tipo TEXT` 'descuento'|'recargo'), **nunca toca** `descuento_pct`/`recargo_pct` (esas reflejan solo la venta original, son un concepto aparte a propósito, decisión explícita de Ariel). Fórmula: `total = subtotal × (1 - descuento_pct/100) × (1 + recargo_pct/100) + ajuste_edicion_monto`.

**Columnas agregadas (producción):**
```sql
ALTER TABLE ventas ADD COLUMN ajuste_edicion_monto NUMERIC(12,2) NULL;
ALTER TABLE ventas ADD COLUMN ajuste_edicion_tipo TEXT NULL;
```

El detalle expandido de Registro Ventas se actualizó para mostrar explícitamente "Subtotal artículos" → "Descuento/Recargo por edición de venta" → "Total", en vez de solo el resultado final sin desglose.

### Bug propio corregido en la misma sesión
Al construir el paso de "Cobrar ahora", el primer intento solo insertaba en `venta_pagos` — no en `movimientos` (el ledger financiero real que alimenta Dashboard y Reportes). No afectaba el arqueo de Caja (que suma directo desde `venta_pagos`), pero sí subcontaba los Ingresos del mes. Corregido antes de la validación final.

### Pendiente al cierre de esta sección (ver sección 16 para actualización)
1. ~~`concepto_gasto_id`/`categoria_gasto_id` correctos para "Egreso por devolución a cliente"~~ — **resuelto en Conversa 11**, ver sección 16.
2. Pantalla "Correcciones" (admin, rol_id=1, para ventas de turnos ya cerrados) — sigue sin construir, solo con la base de datos lista.
3. Limpieza de todas las ventas de prueba de la sesión (múltiples rondas, incluyendo un cierre de turno de prueba) — completada y verificada al cierre de esta sesión, stock y numeración restaurados exactos.

---

## 16. Sesión 06-07/07/2026 — Cierre de pendientes de Editar ítems, 2 bugs nuevos en Compras, limpieza y documentación

Esta semana el trabajo se dividió en 2 chats en paralelo (Conversa 10 y Conversa 11); esta sección consolida ambos.

### Bug: movimiento financiero huérfano por limpieza incompleta
El 06/07, primer día real de caja abierta tras el cierre de la sesión anterior, "Ingresos" del mes ($1.148.300) no coincidía con "Ventas del mes" ($1.145.300) — diferencia exacta de $3.000. Causa: la limpieza de la primera ronda de ventas de prueba (03/07, venta interna id=35) había borrado la venta, sus ítems y sus pagos, pero el script puntual de esa limpieza no incluyó `DELETE FROM movimientos` — quedó un Ingreso de $3.000 huérfano sin venta asociada. Corregido (`DELETE FROM movimientos WHERE id=54`), verificado que ambos totales vuelven a coincidir.

**Lección para todas las limpiezas futuras:** el checklist de tablas a limpiar al borrar una venta/orden de prueba SIEMPRE debe incluir `movimientos` (ledger financiero), además de `venta_items`/`venta_pagos`/`movimientos_stock`/`movimiento_stock_items` — no asumir que ya está cubierto solo porque otras rondas de limpieza sí lo incluyeron.

### Bug: "Costo c/flete" en Compras confundía sin IVA con con IVA
En `compras/nueva/page.tsx` y `compras/[id]/page.tsx`, la columna "Costo c/flete" dividía por IVA (mostraba una base sin IVA) mientras "Precio Unit." mostraba con IVA — el flete visualmente parecía "restar" en vez de sumar, aunque el cálculo interno era correcto. Fix: la columna ahora muestra con IVA (comparable directo a "Precio Unit."), renombrada a "Costo c/flete (c/IVA)". El valor real que se persiste en `costo_sin_iva` al confirmar sigue calculándose sin IVA por dentro (cálculo separado, no afectado).

### Feature: artículos se marcan visibles en salón automáticamente
A pedido de Ariel: cualquier artículo cargado en una orden de compra (nueva o editada) pasa a `disponible_local=true` automáticamente, sin importar si la orden queda en Borrador o se confirma — antes había que activarlo a mano en Artículos después de cada pedido. Implementado en ambos archivos de Compras (`nueva` y `[id]`), con un `UPDATE` que solo toca los que estaban en `false`.

### Bug: `monto_comprobante` no se guardaba al crear una orden nueva
En `compras/nueva/page.tsx`, el campo `monto_comprobante` nunca estaba incluido en el `INSERT` que crea la orden — no era un bug de parseo ni de permisos, directamente faltaba la columna en el payload. Corregido (agregado al `INSERT`); también se agregó `.trim()` a Nro. Factura y Nro. Remito.

### Bug: ajuste por redondeo se perdía al reeditar una orden de compra
En `compras/[id]/page.tsx`: al cargar una orden para editar, el `SELECT` no traía `es_ajuste_redondeo` y el `.map()` de "poblar items" mezclaba el ítem de ajuste (`articulo_id=null`) con los artículos editables normales, sin filtrarlo. Como el guardado hace `DELETE` completo + `INSERT` completo de `orden_compra_items`, al reeditar una orden que ya tenía un ajuste, este se reinsertaba por el camino normal con `es_ajuste_redondeo=false`, perdiendo la marca — caso real detectado: orden EPN (id=5), ítem id=78, subtotal $0,39, quedó en `false`. La orden Disfit (nunca reeditada) no tenía el problema, lo que ayudó a aislar la causa.

**Fix aplicado:**
1. El `SELECT` ahora trae `es_ajuste_redondeo`.
2. El ítem de ajuste se filtra ANTES de poblar la lista editable `items` — nunca se mezcla con los artículos reales. Se guarda aparte en un estado `ajusteExistente`.
3. Al guardar, si no se genera un ajuste NUEVO en ese guardado pero había uno existente, se reinserta preservando `es_ajuste_redondeo=true`.
4. El total de la orden sigue sumando el ajuste correctamente en ambos casos.
5. En el resumen visual, ahora aparece como línea informativa aparte ("Ajuste por redondeo: $X"), ya no como fila fantasma con "—" en la tabla de artículos.

**Dato corregido en producción:** `UPDATE orden_compra_items SET es_ajuste_redondeo=true WHERE id=78;`

### Resuelto (Conversa 11): TODO de "devolución a cliente" en Editar ítems
Se creó `categorias_gasto` id=14 (Devoluciones, tipo Egreso) y `conceptos_gasto` id=45 (Devolución a cliente, Egreso) — se descartó reusar una categoría existente para mantener las devoluciones aisladas en reportes futuros. `EditarItemsVentaModal.tsx` actualizado con lógica condicional: `'devolver'` → 14/45, `'cobrar'` → 10/35 (sin cambios). Las devoluciones pueden ocurrir por cualquier medio de pago (efectivo o transferencia), confirmando que un solo concepto cubriendo todos los medios era el enfoque correcto.

### Nuevo documento: MAPA-ARCHIVOS.md (Conversa 11)
Índice completo de rutas del proyecto — qué hace cada archivo `.tsx`/`.ts` bajo `src/`, organizado por módulo, generado desde un listado real de `Get-ChildItem` (no de memoria, para evitar imprecisiones). 4 archivos marcados `[?]` pendientes de confirmar: `configuracion/page.tsx`, `reportes/page.tsx`, `page.tsx` raíz, `lib/utils.ts`. 2 candidatos a borrar: `compras/[id]/page_compras_id_old.tsx` (backup viejo que no forma parte del build activo) y `diagnostico/page.tsx`. Convención establecida: actualizar `MAPA-ARCHIVOS.md` al cierre de cada sesión cuando se crean o modifican archivos — mismo criterio que `ESTADO-PROYECTO.md`.

### Bug de scroll corregido (Conversa 11): BuscadorProductos.tsx
Al navegar resultados de búsqueda con flechas, el ítem resaltado se salía del área visible del dropdown — el foco de teclado se queda a propósito en el input (diseño anti-rebote de scanner de código de barras), lo que impide el autoscroll nativo del navegador. Fix: array de `itemRefs` + `useEffect` en `indiceFoco` que llama `scrollIntoView({ block: 'nearest' })` sobre el ítem activo.

### Próximos pasos (en orden)
1. Pantalla "Correcciones" (admin) para ventas de turnos cerrados — sin construir.
2. Replicar en sandbox todos los cambios acumulados desde sesión 15 (Compras + Editar ítems + Emisor/Nro. operación).
3. Confirmar los 4 archivos `[?]` de `MAPA-ARCHIVOS.md` y borrar los 2 candidatos (`page_compras_id_old.tsx`, `diagnostico/page.tsx`) si se confirma que no hacen falta.
4. Definir circuito de Nota de Crédito (Caso B) cuando la fiscalización esté activa.

---

## 17. Sesión 08/07/2026 — Corrección de venta mal cargada (artículo equivocado) + nuevo estado "Fiscalizado externamente"

### Caso real: artículo 1329 con stock=1 pero sin presencia física en el local
Ariel detectó, revisando el listado de artículos, que "Citrato De Magnesio - 500 Grs - Frutos Rojos - Star Nutrition" (id=1329) figuraba con `stock_actual=1` pero no había ninguna unidad física en el local. Diagnóstico paso a paso:

1. `articulo_stock.actualizado_en` del id=1329 marcaba `2026-06-27` — **anterior** al arranque en producción (29/06), al conteo físico (30/06) y a la limpieza de arranque (01/07). Ese registro nunca se había tocado desde entonces.
2. Se consultó el historial real de movimientos del artículo vía `movimiento_stock_items` + `movimientos_stock` (no hay una tabla única de "historial por artículo" — hay que cruzar ambas, ver query de referencia abajo): **vacío**, ningún movimiento real desde el arranque.
3. Cruce manual contra el listado de Cover reveló la causa real: existen **dos artículos distintos** con nombres muy parecidos —
   - id=1329: Frutos Rojos
   - id=1330: Neutro
   
   En Cover, la venta del 06/07 cargó correctamente el sabor Frutos Rojos (id equivalente a 1329). En el sistema propio, la venta **#1338** (id interno=45) cargó por error el sabor Neutro (1330) en su lugar — mismo precio ($36.000), por lo que el total de la venta no delató el error a simple vista (mismo patrón que ya había pasado con la venta #1326 en sesión 16).
4. Consecuencia en stock: 1330 quedó en `-1` (absorbió la venta real del 01/07 más esta venta mal cargada del 06/07), mientras 1329 se quedó en `1` sin haber sido descontado nunca — a pesar de haber salido físicamente del local.

### Fix aplicado (transaccional, ejecutado y verificado en producción)
Se corrigió en un único `BEGIN/COMMIT` con 4 pasos:
1. Snapshot del ítem original en `venta_items_historial` (mismo mecanismo que ya usa "Editar ítems", Caso A) antes de tocar nada.
2. `UPDATE venta_items SET articulo_id = 1329 WHERE id = 103` — mismo precio/cantidad/subtotal, el total de la venta no cambia.
3. `ventas.corregido_por_usuario_id`, `corregido_en`, `motivo_correccion` completados a mano sobre la venta id=45 — primer uso real de estas columnas (preparadas desde sesión 03/07 para la futura pantalla "Correcciones", que todavía no existe). Sirve de precedente documentado de qué hacer manualmente hasta que esa pantalla se construya.
4. Reversión de stock vía el mecanismo normal de movimientos (no `UPDATE` directo sobre `articulo_stock`): un movimiento de Ingreso +1 sobre 1330 (revierte el descuento erróneo) y un movimiento de Egreso -1 sobre 1329 (aplica el descuento real), ambos con `origen_tipo='venta'`, `origen_id=45`, pasando por el trigger `fn_aplicar_item_stock` — igual que el resto del sistema. Resultado verificado: ambos artículos en `stock_actual=0.00`.

No fue necesario tocar `movimientos` (ledger financiero) — el precio era idéntico entre los dos artículos, el total y el pago ya registrado seguían siendo correctos.

**Query de referencia para diagnosticar el historial de un artículo (no existe tabla única, hay que cruzar):**
```sql
SELECT
  ms.fecha_utc, tms.nombre AS tipo, sms.nombre AS subtipo,
  ms.origen_tipo, ms.origen_id, msi.cantidad, ms.observaciones
FROM movimiento_stock_items msi
JOIN movimientos_stock ms       ON ms.id = msi.movimiento_stock_id
JOIN tipos_movimiento_stock tms ON tms.id = ms.tipo_movimiento_stock_id
LEFT JOIN subtipos_movimiento_stock sms ON sms.id = ms.subtipo_movimiento_stock_id
WHERE msi.articulo_id = <ARTICULO_ID>
ORDER BY ms.fecha_utc, ms.creado_en;
```

**Aprendizaje:** el stock inicial cargado el 30/06 (conteo físico) se hizo con `UPDATE` directo sobre `articulo_stock`, sin generar movimiento (decisión explícita de esa sesión). Esto significa que la query de arriba **no muestra el valor inicial** como fila — solo lo que pasó desde el 01/07 en adelante. Un `actualizado_en` viejo (anterior al 30/06) en `articulo_stock` es indicio de que ese artículo específico no tuvo ningún movimiento real después del arranque, útil como primera señal de diagnóstico.

### Nuevo estado: `estados_venta.id=5 "Fiscalizado externamente"`
Contexto: 19 ventas cargadas en el sistema propio entre el 01/07 y el 07/07 quedaron con `estado_venta_id=1` ("Fiscal", nombre real verificado — no "Pendiente fiscal" como estaba documentado antes) porque se tildó "Fiscalizar" en el POS, pero la fiscalización real todavía no está activa (pendiente definir proveedor, ver sección 12). Todas esas ventas **ya fueron facturadas en Cover** durante el período paralelo — no hay ninguna pendiente de verdad.

Decisión de diseño acordada con Ariel: en vez de reusar el estado `4=Fiscalizada` (reservado para cuando el sistema propio fiscalice de verdad, con CAE real vía TusFacturasAPP), se creó un estado nuevo y deliberadamente genérico — **sin mencionar "Cover"** — para poder reutilizarlo a futuro ante cualquier fiscalización que ocurra por fuera del sistema propio (otro sistema externo, o incluso ARCA directamente en caso de una falla temporal del sistema propio). Mismo principio que ya se aplicó con `origen_subtipo` en Compras: nunca mezclar dos conceptos distintos bajo la misma etiqueta.

**SQL ejecutado (con nota sobre un problema real encontrado):**
```sql
BEGIN;
-- Necesario: la secuencia de estados_venta estaba desincronizada del MAX(id)
-- real (alguna inserción previa puso un id a mano) — sin este paso, el
-- INSERT fallaba con "duplicate key value violates unique constraint".
SELECT setval(pg_get_serial_sequence('estados_venta', 'id'), (SELECT MAX(id) FROM estados_venta));

WITH nuevo_estado AS (
  INSERT INTO estados_venta (nombre)
  VALUES ('Fiscalizado externamente')
  RETURNING id
)
UPDATE ventas
SET estado_venta_id = (SELECT id FROM nuevo_estado)
WHERE id IN (16,17,18,20,22,23,24,26,27,28,30,31,32,33,34,43,45,48,49);
COMMIT;
```
Resultado verificado: estado creado como `id=5`, 19 ventas migradas, `Fiscal` (id=1) quedó en 0.

**Pendiente de verificar (no bloqueante, a revisar la próxima vez que se toque Dashboard/Reportes):** confirmar que ningún filtro de Dashboard o Registro de Ventas excluye ventas por una lista explícita de `estado_venta_id` (ej. `IN (1,2,4)`) que no contemple el nuevo `5` — si el filtro es del tipo `!= 3` (excluye solo Anuladas) no hay impacto.

**Regla a futuro:** mientras dure el período paralelo (hasta el 12/07), toda venta que se facture en Cover debería cargarse directamente como `Fiscalizado externamente` en el sistema propio, en vez de `Fiscal`, para no repetir este backfill.

### Resuelto en esta sesión: TODO de "devolución a cliente" — reemplazo de los IDs en el código
(Complementa el hallazgo de la sesión anterior, sección 16, donde se crearon `categorias_gasto` id=14 y `conceptos_gasto` id=45.) Se editó `EditarItemsVentaModal.tsx`: la función que arma el `INSERT` a `movimientos` ahora elige `categoria_gasto_id`/`concepto_gasto_id` según `resolucion` — `'devolver'` → 14/45, `'cobrar'` → 10/35 (sin cambios). Ya no queda ningún `TODO` en ese archivo.

### Corrección de documentación: `CLAUDE_CODE_PROMPT.md`
El nombre real de `estados_venta.id=1` en producción es **"Fiscal"**, no "Pendiente fiscal" como estaba documentado — corregido en `CLAUDE_CODE_PROMPT.md` (ver ese archivo). Se suma como otro caso real de por qué la regla "nunca documentar sin verificar con SELECT en producción" importa incluso para datos que parecían ya confirmados.

### Archivos modificados esta sesión
- `components/ventas/EditarItemsVentaModal.tsx` — TODO de devolución resuelto (14/45)
- `components/ventas/BuscadorProductos.tsx` — fix de auto-scroll en navegación con flechas (`itemRefs` + `scrollIntoView`)
- `MAPA-ARCHIVOS.md` — creado (ver sesión anterior) y sumado formalmente a la lista de "Documentos relacionados" de este archivo

### Próximos pasos (en orden)
1. Pantalla "Correcciones" (admin) para ventas de turnos cerrados — sin construir; ya hay un precedente manual documentado (venta #1338) de qué columnas completar mientras tanto.
2. Verificar que Dashboard/Reportes no excluyan el nuevo `estado_venta_id=5` en algún filtro por lista explícita.
3. Replicar en sandbox todos los cambios acumulados desde sesión 15 (Compras, Editar ítems, nuevo estado `Fiscalizado externamente`, corrección de `estados_venta` en la documentación).
4. Confirmar los 4 archivos `[?]` de `MAPA-ARCHIVOS.md` y borrar los 2 candidatos (`page_compras_id_old.tsx`, `diagnostico/page.tsx`).
5. Definir circuito de Nota de Crédito (Caso B) cuando la fiscalización esté activa.
