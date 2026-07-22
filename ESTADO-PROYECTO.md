# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 22/07/2026 — Sesión larga con foco en: mejoras de mobile/responsive (sidebar colapsable, breakpoints del Dashboard), pantalla nueva "Historial de Artículos" (cuenta corriente de stock por artículo con detección de descuadres), reorganización del menú en grupo "Artículos", backfill de saldo inicial de stock (130 artículos) con 3 subtipos nuevos, corrección de un descuadre real de stock (artículo 1177), feature "Duplicar artículo", historial de cajas en la pantalla Caja, corrección de 4 cierres con diferencia falsa, resolución manual de una factura rechazada por ARCA (venta #1398), y varias mejoras de UX en Ventas (columna precio unitario, panel de pagos rediseñado).
**Estado general:** 🟢 Sistema en producción real, fiscalizando de verdad. Se encontró y corrigió un caso real de rechazo de fiscalización automática (sin reintento ni registro de motivo — queda como pendiente crítico agregar diagnóstico). Datos de stock reconciliados con un backfill de saldo inicial + corrección puntual de un descuadre.
**Próxima acción concreta:** Agregar columna de diagnóstico (`mensaje_error` o similar) en `comprobantes` para no volver a quedar a ciegas ante un rechazo de ARCA — hoy no queda registrado en ningún lado y hubo que reconstruir la factura a mano. Evaluar mecanismo de reintento de fiscalización. Revisar si quedan más ventas en `estado_venta_id=1` sin comprobante real (más allá de las que aparecieron en pantalla). Seguir con los filtros pendientes del Historial de cajas.

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas) — **tiene correcciones pendientes de aplicar, ver sección 21**
- `MAPA-ARCHIVOS.md` — índice de rutas: qué hace cada archivo .tsx/.ts del proyecto — **desactualizado, faltan los archivos nuevos de la sesión 22/07 (ver sección 21)**
- `supabase/01_referencia.sql` ✅ al `supabase/08_cierre_turno.sql` ✅ — todos ejecutados
- `supabase/agregar_origen_subtipo.sql` — ejecutado en producción, PENDIENTE en sandbox
- `supabase/limpieza_arranque.sql` — ejecutado en producción (01/07)
- `supabase/numeracion_comprobantes_pv0004.sql` — ejecutado en producción (13/07), no aplicó cambios porque la fila ya existía

---

## 2. El negocio en una línea

Habitus SD: local de suplementos deportivos (Av. Roca 54, Cinco Saltos, Río Negro) + tienda online habitussd.com. Dueño Ariel Vega (monotributista, CUIT 23238900719), un empleado (Agustín, Lun-Vie). Objetivo: reemplazar coverweb.com.ar ($204.900/mes) + Empretienda ($9.490/mes) por sistema propio. Ahorro neto estimado ~$194.000/mes.

---

## 3. Stack tecnológico — CONFIRMADO

| Capa | Tecnología |
|---|---|
| Frontend/Backend | Next.js 16 (App Router) + TypeScript |
| Base de datos | Supabase (PostgreSQL + RLS + Auth) |
| Estilos / UI | Tailwind + shadcn/ui |
| Formularios | React Hook Form + Zod |
| Fechas | date-fns / date-fns-tz |
| Facturación AFIP/ARCA | TusFacturasAPP — EN PRODUCCIÓN REAL desde 14/07/2026 |
| Pagos (MVP v2) | Mercado Pago (webhooks) — pendiente Access Token de Ariel |
| Tipografía sistema | Inter (Google Fonts) — reemplaza Geist |
| Modo offline | No contemplado |

---

## 4. Módulos confirmados (orden de prioridad)

1. Artículos / Inventario ✅ — ahora agrupado en el menú con 4 submenús (ver sección 21)
2. Órdenes de Compra ✅
3. Movimientos de Stock ✅ — ahora permite ver también venta/compra para trazabilidad
4. Ventas (carrito, modo POS, multi-pago) ✅ — panel de pagos mejorado (22/07)
5. Registro de Ventas ✅
6. Movimientos financieros (ledger único) ✅
7. Caja ✅ — con historial de cajas (22/07)
8. Dashboard ✅ — responsive mobile arreglado (22/07)
9. Historial de Artículos ✅ — **nuevo (22/07)**, cuenta corriente de stock por artículo
10. Reportes — pendiente
11. **Facturación AFIP automática — ✅ EN PRODUCCIÓN REAL (14/07/2026)**, con un caso real de rechazo sin diagnóstico encontrado el 22/07 (ver sección 21)
12. Vitrina web propia (reemplaza Empretienda) — post-MVP, sin arrancar. Confirmado con Ariel: el dominio habitussd.com puede reapuntarse a nuestro sistema sin perderlo (es de registro independiente), pero recién tiene sentido cuando este módulo exista — hoy nuestro sistema es gestión interna, no tienda pública.
13. Team Habitus (sponsoreo a deportistas, a costo) — post-MVP

---

## 5. Infraestructura Supabase

- Organización: **Camino Doce Doce - IT**
- **Producción:** habitus-sd-production (ref: lfscdxrhwjpkkirxzhwt, AWS sa-east-1, Pro ~USD25/mes)
- **Sandbox:** habitus-sd-sandbox (AWS sa-east-1, plan Free) — desincronizado, replicar toda la integración TusFacturasAPP cuando haya ventana
- `.env.local` → producción | `.env.development.local` → sandbox
- **Deploy:** https://sistema-habitus-sd.vercel.app (GitHub, auto-deploy en push)
- **Vercel plan Hobby:** los Runtime Logs no retienen lo suficiente hacia atrás para diagnosticar incidentes de más de ~1 hora — confirmado el 22/07 al intentar rastrear un rechazo de fiscalización. No depender de los logs de Vercel para diagnóstico; guardar los datos relevantes en la propia BD.
- **Variables de entorno en Vercel (Production+Preview, todas Sensitive):** `TUSFACTURAS_APIKEY`, `TUSFACTURAS_APITOKEN`, `TUSFACTURAS_USERTOKEN`, `FISCALIZACION_TUSFACTURAS_ACTIVA=true`.

---

## 6. Decisiones pendientes

- [ ] **Agregar columna de diagnóstico en `comprobantes`** (ej. `mensaje_error TEXT`) y capturarla en `api/ventas/route.ts` cuando ARCA/TusFacturasAPP rechaza — hoy no queda registrado en ningún lado (ni en nuestra BD ni accesible en el panel de TusFacturasAPP, que solo muestra comprobantes emitidos con éxito). Encontrado como problema real el 22/07 con la venta #1398 (ver sección 21). **Prioridad alta.**
- [ ] **Evaluar mecanismo de reintento de fiscalización** para ventas que quedan en `estado_fiscal_id=4` (CAE_Rechazado) — hoy `fiscalizacion_intentos` se registra pero no hay ningún reintento automático ni manual desde la UI.
- [ ] Pantalla "Correcciones" (admin, rol_id=1) para ventas de turnos ya cerrados
- [ ] **Circuito de Nota de Crédito (NC) real dentro del sistema** — sigue pendiente el gap de esquema `comprobantes.venta_id UNIQUE` (no permite más de un comprobante por venta)
- [ ] Limpiar políticas RLS duplicadas restantes si aparecen nuevas
- [ ] Confirmar los archivos marcados `[?]` en `MAPA-ARCHIVOS.md`: `configuracion/page.tsx`, `reportes/page.tsx`, `page.tsx` raíz, `lib/utils.ts`
- [ ] Borrar `compras/[id]/page_compras_id_old.tsx` y `src/app/(sistema)/diagnostico/`
- [ ] Tipografías web: licenciar Antique Olive Nord D + Futura MD BT, o alternativas Google Fonts
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2 filas amarillas: −$28.000 del 30/06/2026)
- [ ] Pantalla de ABM de Categorías y Conceptos de movimientos (post-MVP)
- [ ] Reorganización del menú lateral (post-MVP) — ✅ **avance parcial 22/07**: grupo "Artículos" ya armado, ver sección 21
- [ ] Editar historial de cierres de caja (Admin, pantalla separada) — post-MVP. Nota: ya existe un **historial de solo lectura** desde el 22/07 (ver sección 21), esto sería la versión editable.
- [ ] Indicador de rentabilidad caída en listado de artículos
- [ ] Sandbox sigue sin toda la integración TusFacturasAPP — replicar cuando haya ventana
- [ ] **Filtros en Historial de cajas** (fecha, turno, responsable, estado) — pantalla nueva del 17/07, filtros identificados como siguiente paso, todavía no construidos.
- [ ] Rol de Agustín — sigue en `rol_id=1` (Admin) temporal, hasta construir permisos granulares.
- [ ] **Revisar el resto del catálogo por posibles descuadres de stock** — se encontró y corrigió uno más el 22/07 (artículo 1177), además de los 2 de la sesión 17/07 (1136, 1189). Con la pantalla "Historial de Artículos" y su filtro "Solo con diferencia" ya nueva, este chequeo ahora se puede hacer directo desde la UI en vez de pedir SQL.
- [ ] Autocompletar número de operación de pagos con posnet (Mercado Pago) — esperando que Ariel genere el Access Token de producción.
- [ ] Corregir `CLAUDE_CODE_PROMPT.md` — varios datos quedaron desactualizados esta sesión (ver sección 21, detalle de correcciones).
- [ ] Actualizar `MAPA-ARCHIVOS.md` con los archivos nuevos/modificados de la sesión 22/07 (ver sección 21).

---

## 19-20. Sesiones anteriores

Ver detalle completo en el historial del documento (activación de TusFacturasAPP el 14/07, respaldo de Cover y bug de pagos mixtos el 15-17/07). Resumen rápido: fiscalización real activa desde el 14/07; efectivo de Caja/Movimientos reconciliado con la realidad física desde el 17/07; Dashboard rediseñado el 17/07.

---

## 21. Sesión 22/07/2026 — Mobile, Historial de Artículos, backfill de stock, factura rechazada resuelta, UX de Ventas

### Bloque 1 — Responsive / Mobile
- **`Sidebar.tsx`**: reescrito completo para mobile. En desktop (≥768px) se ve igual que siempre. En mobile pasa a ser un menú "cajón" (drawer): botón hamburguesa fijo arriba-izquierda, se desliza con fondo oscuro detrás, se cierra solo al navegar. No hizo falta tocar `layout.tsx`.
- **`dashboard/page.tsx`**: la fila de 5 tarjetas de "Julio de 2026" no se apilaba en 2 columnas en mobile a pesar de tener `sm:`/`lg:` — se simplificó a un solo breakpoint (`md:grid-cols-5`), el mismo que ya se había comprobado funcional con el sidebar. Fix confirmado por Ariel con capturas reales del celular: ahora todo el Dashboard entra en una sola pantalla sin scroll.
- Aprovechando la sesión, otros ajustes menores acumulados del Dashboard: reordenamiento de tarjetas del mes (Ventas/Por turno/Ingresos/Egresos/Diferencia), "Artículos en stock mínimo" cerrado por defecto, "Clima del negocio" en grid 2×2, "Stock valorizado" reubicado debajo de Clima del negocio (antes ocupaba una fila propia a todo el ancho).

### Bloque 2 — Historial de cajas (pantalla Caja)
Se agregó una tabla "Historial de cajas" debajo de la vista principal de `cierre-turno/page.tsx` (visible con caja abierta o cerrada): últimas 30 cajas con Fecha, Turno, Responsable, horario de Apertura/Cierre, **Dinero apertura → Ingresos → Egresos → Dinero cierre** (orden ajustado a pedido de Ariel, calcado del formato de su planilla vieja en papel), Diferencia y Estado (Cuadrada/Con diferencia/Abierta, con badges de color). Se refresca solo al abrir/cerrar turno.

Al revisar el historial, Ariel detectó 4 cierres marcados "Con diferencia" que nunca deberían haberlo estado: **ids 22, 28, 34, 35**. Investigado con SQL: el `ingresos_sistema`/`egresos_sistema`/`resultado_sistema` de esos cierres había quedado congelado en el momento del cierre, **antes** de que se aplicaran las correcciones retroactivas de la sesión del 17/07 (venta #1378 con pago mixto reclasificado, sueldo de Agustín corregido) — esas correcciones insertaron movimientos con fecha pasada que caían dentro de la ventana de esos turnos ya cerrados, pero el snapshot nunca se recalculó. Confirmado recalculando en vivo: la diferencia real era $0 en los 4 casos. Corregidos con `UPDATE` puntual (`diferencia=0`, `estado_cierre_turno_id=2`).

### Bloque 3 — Nueva categoría de gasto
Ariel tenía un gasto recurrente en bolsas para entregar ventas sin categoría que le calzara. Se creó:
- `categorias_gasto` id=**15** — "Insumos" (Egreso)
- `conceptos_gasto` id=**48** — "Bolsas / Packaging"

### Bloque 4 — Más ventas reclasificadas a "Fiscalizado externamente"
Se encontraron 7 ventas más en `estado_venta_id=1` ("Fiscal", pendiente) sin comprobante real asociado — todas del período paralelo con Cover (08/07 y 13/07, antes de la activación real del 14/07). Mismo patrón ya resuelto en sesiones anteriores para 25 ventas previas. Reclasificadas a `estado_venta_id=5`:
`ventas.id` 53, 55, 56, 64, 65, 66, 68 (`numero_venta` 1346, 1348, 1349, 1357, 1358, 1359, 1361).

### Bloque 5 — Bug real encontrado: Stock nunca mostraba movimientos manuales
Ariel reportó que "Movimientos de stock" (`stock/page.tsx`) nunca mostró ningún movimiento manual, desde siempre — no era un bug reciente. Causa: `MovimientoStockForm.tsx` insertaba `origen_tipo: 'manual'` (string) al crear un movimiento, pero `stock/page.tsx` filtraba con `.is('origen_tipo', null)` — nunca podían cruzar. La convención correcta (ya usada en el resto del sistema, incluido el ledger financiero) es que los movimientos manuales tengan `origen_tipo IS NULL`. **Fix:** el alta ahora inserta `origen_tipo: null`. Se corrigió también el dato histórico ya cargado (`UPDATE movimientos_stock SET origen_tipo = NULL WHERE origen_tipo = 'manual'`).

De paso, a pedido de Ariel, `stock/page.tsx` se convirtió en una herramienta de trazabilidad más completa: se sacó el filtro fijo (ahora trae hasta 300 movimientos, no solo los manuales) y se agregó un checkbox **"Excluir venta/compra"** (tildado por defecto, mismo patrón que "Excluir movimientos internos de Caja" en Movimientos) para poder ver también los movimientos automáticos cuando se busca el historial de un artículo puntual.

### Bloque 6 — Backfill de "Saldo inicial" de stock + subtipos nuevos
Se creó una función de una sola vez para dejar registrado, con fecha 01/07/2026 (fecha confirmada por Ariel como el arranque real del catálogo), el saldo inicial de cada artículo que hoy tiene stock — porque el `UPDATE` original de carga de catálogo nunca dejó rastro en `movimientos_stock`.

**Subtipos nuevos creados** en `subtipos_movimiento_stock`:
- id=**4** — Saldo inicial (Ingreso)
- id=**5** — Regalado (Egreso)
- id=**6** — Vencido (Egreso)
- id=**7** — Corrección de stock (Ingreso) — agregado sobre la marcha al necesitarlo para el Bloque 7

**Backfill ejecutado:** bloque `DO $$ ... $$` en PL/pgSQL, un movimiento "Saldo inicial" por artículo (130 artículos con saldo positivo), calculado retrocediendo desde el `stock_actual` de hoy menos todo lo que entró/salió desde el 01/07. El trigger `fn_aplicar_item_stock` se **desactivó a propósito durante el backfill** (`ALTER TABLE movimiento_stock_items DISABLE/ENABLE TRIGGER USER`) para no duplicar el stock que ya estaba reflejado en `articulo_stock.stock_actual`. Verificado post-backfill: ningún `stock_actual` quedó negativo salvo un caso real (ver Bloque 7).

**Importante — riesgo identificado y ya corregido:** como estas 130 filas se insertaron con el trigger desactivado, borrarlas ahora (vía "Eliminar" en la pantalla Stock) restaría el monto del stock real de verdad, descuadrando todo. Se bloqueó Editar/Eliminar específicamente para movimientos con subtipo "Saldo inicial" en `stock/page.tsx` (gris, no clickeable, con traba también dentro de la función `eliminar()` como defensa extra). También se excluyen del checkbox "Excluir venta/compra".

### Bloque 7 — Descuadre real encontrado y corregido: artículo 1177
Durante la verificación del backfill apareció un `stock_actual=-1` real: `Pre War - 400 Gr - 20 Servicios - Fruit Punch - Ena`. Investigado: la venta #1380 lo vendió sin stock suficiente. Conteo físico real de Ariel: 1 unidad. Corregido con un movimiento tipo Ingreso, subtipo "Corrección de stock" (id=7), +2 unidades → quedó en `stock_actual=1`, coincidiendo con el conteo físico.

### Bloque 8 — Pantalla nueva: Historial de Artículos
Después de una conversación de diseño (sin código) usando como referencia la pantalla "Administrar Artículos" de Cover (capturas que Ariel ya tenía guardadas), se construyó `articulos/historial/page.tsx`:

- **Filtros:** Rubro, Marca (dependiente del Rubro elegido, mismo patrón que en Artículos), Nombre, rango de fechas (Mov. desde/Hasta), checkbox **"Solo con diferencia"**.
- **Grilla maestro** por artículo: Rubro, Marca, Ingreso, Egreso (de las fechas filtradas), **Stock Calculado** (siempre sobre el historial completo, nunca se recorta por el filtro de fecha), **Stock** (real, de `articulo_stock`) — fila resaltada en naranja si no coinciden.
- **Detalle expandible:** línea de tiempo cronológica por artículo — Fecha, Tipo, Motivo (subtipo o "Venta"/"Compra"), Detalle (observaciones), Cantidad con signo, Stock Calculado corrido. El signo de cada movimiento replica exactamente la lógica del trigger `fn_aplicar_item_stock` (Egreso resta, todo lo demás suma) para que el número cierre siempre que no haya un descuadre real.
- Filtrada a artículos con `disponible_local=true` únicamente (a pedido de Ariel — "por el momento es el único lugar donde hay mercadería, no tiene sentido ver el listado completo").
- **Explicado a Ariel el propósito de la columna Stock Calculado vs Stock:** en uso normal del sistema siempre van a coincidir (son la misma cuenta hecha por dos caminos). Solo se desalinean cuando algo tocó `articulo_stock` por fuera del circuito formal de movimientos — es un chequeo de integridad, no dos formas distintas de contar stock.

### Bloque 9 — Reorganización del menú: grupo "Artículos"
A pedido de Ariel (el ítem "Stock" del menú confundía — mostraba movimientos, no niveles de stock), se reorganizó `Sidebar.tsx` en un grupo acordeón:

```
Artículos (grupo, solo despliega submenú, sin ruta propia)
  ├─ Administrar Artículos   (antes "Artículos", misma ruta /articulos)
  ├─ Actualizar Precios      (antes solo accesible por botón interno, ahora también en el menú)
  ├─ Historial de Artículos  (nuevo, /articulos/historial)
  └─ Movimientos de Stock    (antes "Stock", mismo /stock, solo cambió el label)
```

No hizo falta mover ninguna carpeta ni renombrar rutas — solo el label y la agrupación visual. Se corrigió también la lógica de "activo" del sidebar (antes usaba `startsWith` simple, lo que resaltaba dos ítems a la vez en rutas anidadas como `/articulos` vs `/articulos/precios`) para usar coincidencia por prefijo más largo.

### Bloque 10 — Fix: avisos de diferencia en Compras quedaban pegados
Ariel reportó que en `compras/[id]/page.tsx`, después de corregir los artículos de una orden, el aviso rojo ("El total de artículos difiere del monto del comprobante...") y el amarillo (de redondeo) seguían visibles con el número viejo, aunque ya hubiera terminado de cargar bien. Causa: ambos avisos solo se calculaban al tocar Guardar/Confirmar, y quedaban en el estado hasta que se guardaba con éxito o se cerraban a mano. **Fix:** nuevo `useEffect` que limpia ambos avisos apenas cambia algo relevante (artículos, monto del comprobante, flete) — si la diferencia sigue existiendo de verdad, reaparece recalculada al reintentar guardar.

### Bloque 11 — Feature: Duplicar artículo
A pedido de Ariel (tenía que cargar 3 variantes de sabor del mismo producto una por una, igual que le pasaba con Empretienda). Se agregó un ícono "Duplicar" (índigo, al lado de Editar) en `articulos/page.tsx`, que lleva a `/articulos/nuevo?duplicar=<id>`. `ArticuloForm.tsx` lee ese parámetro (con `window.location.search` directo, no `useSearchParams`, para no forzar un Suspense boundary y evitar el error de build que salió en el primer intento) y precarga:
- **Se copia:** rubro, marca, unidad, costo, tasa IVA, todos los precios (local/web/mayorista/oferta), disponibilidad local/web/tienda.
- **No se copia:** código interno, código de barras, SKU (deben ser únicos), y todo "Web y extras" (nombre base, atributo/sabor, peso, descripción) — son justo los datos que cambian entre variantes.
- **El nombre sí se copia** (para no tener que retipearlo entero), pero **se bloquea el guardado** si se deja idéntico al original — obliga a cambiar algo (ej. el sabor) antes de poder guardar.

Probado en caliente con un caso real: "Syntha 6 Whey Protein 1.45 lb" en 3 sabores (Chocolate cargado a mano, Frutilla y Vainilla duplicados). Verificado con SQL que Identificación/Precios/Disponibilidad quedaron idénticos entre original y duplicados, y que código interno/barras/SKU y Web y extras quedaron vacíos como corresponde.

### Bloque 12 — Investigación GoDaddy: dominio habitussd.com
Ariel preguntó si podía dejar de pagar Empretienda sin perder el dominio. Revisado en vivo (navegador conectado):
- **Plan contratado:** solo registro de dominio, **$22.99 USD/año**, próxima renovación **07/11/2026**. Sin plan de hosting/tienda pagando aparte.
- El "Website" que aparecía junto al dominio en el panel **no es Empretienda** — es el creador de sitios propio de GoDaddy (Websites + Marketing), Plan FREE, sin publicar. No representa costo.
- **Registros DNS revisados** (compartidos por Ariel en captura): 2 registros Tipo A (raíz y `www`) apuntan a Empretienda — son los únicos que habría que tocar el día de la migración. Los otros 4 (MX, TXT/SPF, `autodiscover` CNAME, `email` CNAME) son del correo `@habitussd.com` vía Microsoft 365/Outlook — **no tocar nunca**, no tienen relación con Empretienda.
- **Confirmado:** el registro de dominio es siempre por dominio individual, no hay plan que cubra varios al mismo precio. Se le explicó a Ariel el combo promocional de GoDaddy (`.me`+`.net`+`.vip`+`.shop`+`.store` por $29.97 el primer año) con la salvedad de que ese precio es solo año 1, cada uno se renueva por separado a precio de lista después.
- **Conclusión para Ariel:** puede dar de baja Empretienda sin perder el dominio. La migración de los registros A a Vercel queda pendiente de la vitrina web propia (todavía sin arrancar) — mientras tanto el sistema es solo gestión interna, no reemplaza la tienda pública.

### Bloque 13 — Aclaración: Retiro de caja vs Egreso
Ariel tenía dudas sobre por qué un retiro de $80.000 aparecía como "Egreso en efectivo" en vez de "Retiro de caja". Se le explicó la diferencia conceptual: **Retiro de caja** = mover plata de lugar sin que sea un gasto real (depósito bancario, caja fuerte) — excluido del resumen de Ingresos/Egresos del Dashboard. **Egreso** = un gasto real del negocio (sueldo, proveedor, alquiler). Los dos bajan el efectivo esperado igual durante el cierre de turno; la diferencia es solo de clasificación posterior. Sin acción de código, quedó resuelto como aclaración.

### Bloque 14 — Incidente real resuelto: venta #1398 rechazada por ARCA
Agustín hizo una venta ($34.000, QR Mercado Pago) que quedó en "Pend. fiscal". Investigado con SQL (corrigiendo sobre la marcha varias suposiciones de estructura de `comprobantes` y `clientes` que no estaban bien documentadas): la venta tenía un comprobante real (`id=56`) con `estado_fiscal_id=4` (**CAE_Rechazado**), un solo intento, sin CAE. **No era un caso de los ya conocidos** (ventas viejas del período paralelo) — fue un rechazo real de ARCA el mismo día.

Intentando diagnosticar la causa real del rechazo se confirmó que:
- TusFacturasAPP no muestra en ningún listado de su panel web los comprobantes rechazados — "Mis ventas" solo lista los emitidos con éxito.
- Los Runtime Logs de Vercel (plan Hobby) no retienen lo suficiente hacia atrás para encontrar la respuesta cruda de la API en el momento del rechazo.
- **Conclusión: el motivo exacto del rechazo se perdió**, porque el sistema no lo guarda en ninguna columna propia (ver pendiente en sección 6).

**Resuelto de forma manual y verificada paso a paso**, con capturas de confirmación en cada etapa: se emitió la factura real a través del formulario web "Nueva Venta rápida a Consumidor Final" de TusFacturasAPP (no por API directa, para dejar que la plataforma asigne el número correlativo real y evitar otro desalineamiento de numeración como el de la sesión del 14/07) — **Factura C 0004-00000022, CAE 86294841509462**, vencimiento CAE 31/07/2026, coincidiendo exacto ($34.000,00) con el número ya reservado internamente y con el total de la venta.

Actualizado en el sistema:
```sql
UPDATE ventas SET observaciones = '...', estado_venta_id = 4 WHERE id = 105;
UPDATE comprobantes SET estado_fiscal_id = 3, factura_cae = '86294841509462', factura_cae_vencimiento = '2026-07-31', numero = 22 WHERE id = 56;
```
(estado_venta_id=4 "Fiscalizada", no 5 "Fiscalizado externamente" — es una Factura C real emitida bajo el mismo CUIT y punto de venta, solo que el disparo fue manual.)

### Bloque 15 — Backfill de código interno faltante
Ariel notó que el buscador de Ventas mostraba códigos ("Cód: ...") en artículos a los que nunca les había asignado uno — eran su código de barras, mostrado porque `codigo_interno` estaba vacío. Verificado antes de tocar nada: 112 artículos tenían código de barras pero no interno, 346 ya tenían interno cargado, 35 no tenían ninguno de los dos. Chequeado que no hubiera colisión de UNIQUE antes de correr. Ejecutado:
```sql
UPDATE articulos SET codigo_interno = codigo_barra
WHERE codigo_interno IS NULL AND codigo_barra IS NOT NULL AND activo = true;
```
112 filas actualizadas sin errores. Los 35 sin ningún código no se tocaron (no había de dónde copiar).

### Bloque 16 — Mejoras de UX en Ventas
Inspirado en una comparación con otro sistema POS (Fácil Virtual) que Ariel trajo como referencia:
- **`CarritoItems.tsx`**: nueva columna "Precio Unit." (antes solo aparecía como texto chico debajo del nombre del producto).
- **`PanelPagos.tsx`**: panel un poco más ancho (384px → 440px). El monto "Pendiente" pasó a llamarse **"Restan pagar"** cuando hay saldo a favor, con texto grande y rojo (igual jerarquía visual que "Total") — antes era chico y fácil de pasar por alto. Además, se diferenciaron visualmente los pagos ya cargados (fondo verde clarito + ✓) del formulario para cargar el próximo pago (fondo gris, con título "AGREGAR OTRO PAGO" y más separación) — antes ambos bloques eran blancos y se confundían entre sí.

### Correcciones a `CLAUDE_CODE_PROMPT.md` (aplicar en la próxima edición del archivo)
Se encontraron varios datos desactualizados o directamente incorrectos durante esta sesión, verificados contra producción con `information_schema.columns`:
- `movimientos_stock` **no tiene** columna `usuario_id` (el doc la daba por existente).
- `fecha_utc` en `movimientos_stock` es `DATE` (no `TIMESTAMPTZ` como decía una versión previa).
- `subtipos_movimiento_stock` **sí tiene** columna `activo` (el doc no la mencionaba).
- `tipos_movimiento_stock` son solo `1=Ingreso, 2=Egreso, 3=Transferencia` — **no existe** un id=5 "Ajuste" como se había asumido en una sesión previa. Para correcciones de stock se usa el subtipo id=7 "Corrección de stock" dentro de tipo Ingreso.
- `clientes`: columna es `nombre` (texto único, no nombre/apellido separados), tiene `cuit` y `dni` como columnas separadas, `condicion_iva_id`, `tiene_cuenta_corriente`, `plazo_dias_cta_cte`, `descuento_default_pct` — no estaba documentada en detalle.
- `comprobantes`: columnas reales son `id, venta_id, tipo_comprobante_id, punto_venta_id, numero, comprobante_asociado_id, estado_fiscal_id, factura_cae, factura_cae_vencimiento, fecha_emision_utc, fiscalizacion_intentos, creado_en, total, impreso_enviado` — no tiene columna de mensaje de error (ver pendiente crítico en sección 6).
- `estados_fiscales`: 1=Pendiente, 2=Enviado, 3=CAE_Recibido, 4=CAE_Rechazado, 5=Reintentando, 6=Anulado.

### Archivos nuevos o modificados en esta sesión (para actualizar `MAPA-ARCHIVOS.md`)
- `src/components/layout/Sidebar.tsx` — reescrito completo: drawer mobile + grupo acordeón "Artículos"
- `src/app/(sistema)/dashboard/page.tsx` — reorden de tarjetas, breakpoint responsive, Clima 2x2, Stock valorizado reubicado
- `src/app/(sistema)/cierre-turno/page.tsx` — tabla "Historial de cajas" agregada
- `src/app/(sistema)/stock/page.tsx` — checkbox "Excluir venta/compra" (ahora incluye Saldo inicial), sin filtro fijo, traba de Editar/Eliminar para Saldo inicial
- `src/components/stock/MovimientoStockForm.tsx` — fix `origen_tipo: null` (antes `'manual'`)
- `src/app/(sistema)/articulos/historial/page.tsx` — **nuevo**, pantalla Historial de Artículos
- `src/app/(sistema)/compras/[id]/page.tsx` — avisos de diferencia se auto-limpian al editar
- `src/app/(sistema)/articulos/page.tsx` — ícono "Duplicar" agregado
- `src/components/articulos/ArticuloForm.tsx` — lógica de duplicación (`?duplicar=<id>`)
- `src/components/ventas/CarritoItems.tsx` — columna "Precio Unit."
- `src/components/ventas/PanelPagos.tsx` — ancho, "Restan pagar" prominente, diferenciación visual pagos/formulario

### Pendiente para la próxima sesión
1. Agregar columna de diagnóstico en `comprobantes` (mensaje de error de rechazo) — prioridad alta.
2. Evaluar reintento de fiscalización para ventas `CAE_Rechazado`.
3. Filtros del Historial de cajas (fecha, turno, responsable, estado).
4. Revisión más amplia de ventas en `estado_venta_id=1` sin comprobante real.
5. Corregir `CLAUDE_CODE_PROMPT.md` con las correcciones listadas arriba.
6. Actualizar `MAPA-ARCHIVOS.md` con los archivos nuevos/modificados.
7. Seguir con los pendientes ya anotados de sesiones previas (Mercado Pago, permisos de Agustín, NC, sandbox — ver sección 6).
