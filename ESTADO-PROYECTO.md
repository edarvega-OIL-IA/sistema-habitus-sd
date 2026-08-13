# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 13/08/2026 (madrugada) — Cierre de la sesión larga del 12/08. Se sumó un fix de validación real en la cancelación de Pedidos Web (devolución sin monto cargado quedaba en silencio), y **se confirmó un tercer caso del bug de stock huérfano del webhook de Mercado Pago** (ventas #196, #197, y ahora #224) — con 3 casos ya no es "a vigilar", pasa a ser prioridad alta de investigación real para la próxima sesión.
**Estado general:** 🟢 En producción, con datos corregidos a mano en los 2 casos puntuales detectados (financiero y de stock de la venta #224). El patrón de fondo del webhook sigue sin resolverse — necesita atraparse en el momento (Logs de Vercel en vivo) la próxima vez que ocurra.
**Próxima acción concreta:** ver la lista de pendientes por prioridad al final de la sección 26 — el ítem 1 (investigar el bug del webhook) es el más importante y el más difícil de resolver sin un caso fresco para diagnosticar en el momento.

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas) — actualizado con lo de la sesión 23 (ver sección 23)
- `MAPA-ARCHIVOS.md` — índice de rutas: qué hace cada archivo .tsx/.ts del proyecto — PENDIENTE actualizar con los archivos tocados en sesión 26 (`pedidos-web/page.tsx` reescrito, `tienda/checkout/page.tsx`, `api/tienda/checkout/route.ts`, `api/tienda/page.tsx`, `components/tienda/OrdenTienda.tsx`, `articulos/historial/page.tsx`, `obligaciones/page.tsx`)
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

1. Artículos / Inventario ✅ — agrupado en el menú con 4 submenús (22/07); **sistema de Sabores estándar + glosa de precios para WhatsApp/IG (25/07, ver sección 22)**, con 5 de ~20 rubros migrados
2. Órdenes de Compra ✅
3. Movimientos de Stock ✅ — ahora permite ver también venta/compra para trazabilidad
4. Ventas (carrito, modo POS, multi-pago) ✅ — panel de pagos mejorado (22/07)
5. Registro de Ventas ✅
6. Movimientos financieros (ledger único) ✅
7. Caja ✅ — con historial de cajas (22/07)
8. Dashboard ✅ — responsive mobile arreglado (22/07)
9. Historial de Artículos ✅ — **nuevo (22/07)**, cuenta corriente de stock por artículo
10. Reportes ✅ — **nuevo (03/08)**, Ventas mensuales + Punto de Equilibrio real por mes, Utilidad mensual Bruta/Gastos/Neta, filtro de Año
11. **Facturación AFIP automática — ✅ EN PRODUCCIÓN REAL (14/07/2026)**, con reintento manual desde la pantalla **Fiscalización** (29/07, ver sección 23) para lo que falla o queda sin fiscalizar
11.b **Obligaciones — ✅ nuevo (29/07)**, cuenta corriente por acreedor con cargos y pagos, ver sección 23
12. Vitrina web propia (reemplaza Empretienda) — post-MVP, sin arrancar. Confirmado con Ariel: el dominio habitussd.com puede reapuntarse a nuestro sistema sin perderlo (es de registro independiente), pero recién tiene sentido cuando este módulo exista — hoy nuestro sistema es gestión interna, no tienda pública.
13. Team Habitus (sponsoreo a deportistas, a costo) — post-MVP

---

## 5. Infraestructura Supabase

- Organización: **Camino Doce Doce - IT**
- **Producción:** habitus-sd-production (ref: lfscdxrhwjpkkirxzhwt, AWS sa-east-1, Pro ~USD25/mes)
- **Sandbox:** habitus-sd-sandbox (AWS sa-east-1, plan Free) — desincronizado, replicar toda la integración TusFacturasAPP cuando haya ventana
- `.env.local` → producción | `.env.development.local` → sandbox
- **Deploy:** https://sistema-habitus-sd.vercel.app (GitHub, auto-deploy en push)
- **Vercel plan Hobby:** los Runtime Logs no retienen lo suficiente hacia atrás para diagnosticar incidentes de más de ~1 hora. Ya no es tan crítico como antes: desde el 29/07 el motivo real de un rechazo de ARCA/TusFacturasAPP queda guardado en `comprobantes.mensaje_error`, visible directo en la pantalla Fiscalización — no depende de los logs de Vercel.
- **Numeración de comprobantes:** si alguna vez se emite una factura real a mano por el portal web de TusFacturasAPP (en vez de por la API), `numeracion_comprobantes.ultimo_numero` no se entera solo — hay que corregirlo a mano (`UPDATE ... SET ultimo_numero = X`) antes de la próxima fiscalización por sistema, o va a pedir un número ya usado. Pasó el 27/07 con el comprobante 0004-00000031 (Municipalidad).
- **Variables de entorno en Vercel (Production+Preview, todas Sensitive):** `TUSFACTURAS_APIKEY`, `TUSFACTURAS_APITOKEN`, `TUSFACTURAS_USERTOKEN`, `FISCALIZACION_TUSFACTURAS_ACTIVA=true`.

---

## 6. Decisiones pendientes

- [ ] **Agregar columna de diagnóstico en `comprobantes`** (ej. `mensaje_error TEXT`) y capturarla en `api/ventas/route.ts` cuando ARCA/TusFacturasAPP rechaza — hoy no queda registrado en ningún lado (ni en nuestra BD ni accesible en el panel de TusFacturasAPP, que solo muestra comprobantes emitidos con éxito). Encontrado como problema real el 22/07 con la venta #1398 (ver sección 21). **Prioridad alta.**
- [ ] **Evaluar mecanismo de reintento de fiscalización automático** — el reintento manual desde `/fiscalizacion` ya funciona y se probó con éxito real el 03/08 (ventas #1437-#1440); lo que falta es decidir si conviene automatizarlo (cron/reintento programado) para no depender de que Ariel entre a la pantalla. Se agregó una advertencia (no bloqueante) cuando hay un comprobante anterior sin CAE confirmado, para evitar reintentos fuera de orden — evaluar si conviene que directamente bloquee en vez de solo advertir.
- [ ] Pantalla "Correcciones" (admin, rol_id=1) para ventas de turnos ya cerrados
- [ ] **Circuito de Nota de Crédito (NC) real dentro del sistema** — sigue pendiente el gap de esquema `comprobantes.venta_id UNIQUE` (no permite más de un comprobante por venta)
- [ ] Limpiar políticas RLS duplicadas restantes si aparecen nuevas
- [ ] Confirmar los archivos marcados `[?]` en `MAPA-ARCHIVOS.md`: `configuracion/page.tsx`, `page.tsx` raíz, `lib/utils.ts` (`reportes/page.tsx` ya no aplica — construido completo el 03/08)
- [ ] Borrar `compras/[id]/page_compras_id_old.tsx` y `src/app/(sistema)/diagnostico/`
- [ ] Tipografías web: licenciar Antique Olive Nord D + Futura MD BT, o alternativas Google Fonts
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2 filas amarillas: −$28.000 del 30/06/2026)
- [ ] Pantalla de ABM de Categorías y Conceptos de movimientos (post-MVP)
- [ ] Reorganización del menú lateral (post-MVP) — ✅ **avance parcial 22/07**: grupo "Artículos" ya armado, ver sección 21
- [ ] Editar historial de cierres de caja (Admin, pantalla separada) — post-MVP. Nota: ya existe un **historial de solo lectura** desde el 22/07 (ver sección 21), esto sería la versión editable.
- [ ] Indicador de rentabilidad caída en listado de artículos
- [ ] Sandbox sigue sin toda la integración TusFacturasAPP — replicar cuando haya ventana. Sumar también lo de esta sesión (03/08): Alquiler recategorizado a Servicios, concepto Supermercado en Insumos, condición de Período/Vencimiento en `MovimientoForm.tsx`.
- [ ] **Filtros en Historial de cajas** (fecha, turno, responsable, estado) — pantalla nueva del 17/07, filtros identificados como siguiente paso, todavía no construidos.
- [ ] Rol de Agustín — sigue en `rol_id=1` (Admin) temporal, hasta construir permisos granulares.
- [ ] **Revisar el resto del catálogo por posibles descuadres de stock** — se encontró y corrigió uno más el 22/07 (artículo 1177), además de los 2 de la sesión 17/07 (1136, 1189). Con la pantalla "Historial de Artículos" y su filtro "Solo con diferencia" ya nueva, este chequeo ahora se puede hacer directo desde la UI en vez de pedir SQL.
- [ ] Autocompletar número de operación de pagos con posnet (Mercado Pago) — esperando que Ariel genere el Access Token de producción.
- [ ] Corregir `CLAUDE_CODE_PROMPT.md` — varios datos quedaron desactualizados esta sesión (ver sección 21, detalle de correcciones).
- [ ] Actualizar `MAPA-ARCHIVOS.md` con los archivos nuevos/modificados de la sesión 22/07 (ver sección 21).
- [ ] **Migrar el resto de los rubros al sistema de Sabores** (`nombre_base` + `sabor_id`) para que la glosa los agrupe — Salud y bienestar (35), Shakers (30), Pre-entrenamiento (26), Colágenos (25), Aminoácidos (21), Óxido Nítrico (13), Quemadores (12), Foods (12), Ganadores de peso (11), Proteínas Vegetales (10), Multivitamínicos (9), Glutamina (8), Energía (7), Pro Hormonal (7), Sales (5). Ver sección 22 para el mecanismo (Excel + `UPDATE` en lote).
- [ ] **Duplicado real sin resolver:** "Bcaa 2000 - 120 Cápsulas" (2 ids activos) — detectado hace varias sesiones, sigue sin decidirse cuál de los dos desactivar.
- [ ] Tabla `tipos_medida` (Gr/Kg/Lb/Cápsulas...) + columnas `medida_tipo_id`/`cantidad_medida` en `articulos`, para filtros de la vitrina web — diseño conversado con Ariel (ver sección 22), sin SQL ejecutado todavía.
- [ ] Sumar más `componentes` cuando se migren Pre-entrenamiento/Óxido Nítrico (Taurina, Arginina, Citrulina, Beta-Alanina) y Colágenos (Resveratrol) — hoy la tabla `componentes` solo tiene Cafeína.
- [ ] Actualizar `MAPA-ARCHIVOS.md` y `CLAUDE_CODE_PROMPT.md` con lo de la sesión 25/07 (tabla `sabores`, `componentes`, `articulo_componentes`, columna `articulos.sabor_id`, trigger `fn_generar_nombre_articulo`, cambios en `ArticuloForm.tsx` y `articulos/page.tsx`). ✅ **hecho el 29/07, sección 23.**
- [ ] **Evaluar mecanismo de reintento automático de fiscalización** para ventas en `CAE_Rechazado` — hoy el reintento existe pero es manual, desde la pantalla Fiscalización (29/07). Sigue sin haber un reintento automático programado.
- [ ] **Verificar RLS + GRANT en tablas viejas antes de sumarles un JOIN nuevo** — el 27/07 se rompió la fiscalización automática en producción porque `condiciones_iva`, `localidades` y `tipos_cliente` (tablas preexistentes, nunca antes consultadas desde el pipeline) no tenían `GRANT SELECT` para `authenticated`. Ya corregido, pero como lección: no asumir que una tabla vieja tiene el GRANT completo solo porque ya existía.
- [ ] Sandbox sigue sin la integración de Fiscalización manual ni las tablas de Obligaciones — replicar cuando haya ventana.
- [ ] Seguir sumando acreedores a Obligaciones a medida que aparezcan pagos sueltos en Movimientos — correr la consulta de "resumen de faltantes" (sección 23, Bloque 11) cada tanto.
- [ ] Decidir si Insumos (Artículos de limpieza, Bolsas/Packaging) necesita algún tipo de seguimiento en Obligaciones — por ahora, decidido que no (no tienen un proveedor fijo).
- [ ] Revisar si conviene sumar `condicion_pago` a más plazos estándar en `mapeo.ts` si aparece un acreedor con cuenta corriente a un plazo no contemplado (hoy: 5, 10, 15, 20, 30, 45, 60, 90 días — cualquier otro cae al código genérico de cuenta corriente `205`).

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

---

## 22. Sesión 25/07/2026 — Sistema de Sabores estándar, migración de 5 rubros, y glosa de precios

### Bloque 1 — Arquitectura del sistema de Sabores (diseño de sesión previa, ejecutado hoy)

Objetivo de fondo: armar una glosa de precios agrupada por producto (no por SKU) para copiar/pegar en WhatsApp/Instagram, sin tocar cómo se guarda el stock (cada sabor sigue siendo un artículo independiente en el POS, con su propio código de barras).

Decisiones de diseño ya cerradas antes de esta sesión, ejecutadas hoy:
- El **contenido** (gr/kg/lb, cápsulas) sigue siendo texto libre dentro de `nombre_base` — no es un atributo aparte, porque nunca varía dentro de un mismo grupo de sabores.
- El **sabor** se separa en dos campos: **Sabor estándar** (nuevo, lista controlada, para agrupar) y **Nombre comercial del sabor** (ya existía como `atributo_valor`, texto libre, para mostrar el nombre real del fabricante).

```sql
CREATE TABLE sabores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE articulos ADD COLUMN sabor_id BIGINT REFERENCES sabores(id);
```

**Sabores cargados a lo largo de la sesión (26 en total):** Chocolate, Vainilla, Frutilla, Banana, Frutos Rojos, Dulce De Leche, Cookies, Neutro (set inicial) + Café, Coco, Limón, Maracuyá, Menta, Pistacho, Almendras, Avellana, Manzana, Caramelo, Cereza, Multifrutas, Naranja, Ananá, Uva, Citrus, Mango, Arándano, Pomelo (agregados sobre la marcha a medida que aparecían en cada rubro).

**Bug propio encontrado y corregido:** la tabla `sabores` se creó sin RLS habilitado y sin `GRANT SELECT` para `authenticated` — mismo patrón de siempre al crear una tabla nueva (visto ya con `movimientos_stock` en sesiones previas). El `SELECT` desde el SQL Editor funcionaba igual porque corre con otro rol, por eso no se notó hasta que el combo "Sabor" del formulario apareció vacío. Corregido:
```sql
ALTER TABLE sabores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON sabores FOR SELECT TO authenticated USING (true);
GRANT SELECT ON sabores TO authenticated;
```

**Trigger que arma el `nombre` solo**, para no depender de que alguien lo tipee a mano ni de que quede desactualizado si cambia el sabor:
```sql
CREATE OR REPLACE FUNCTION fn_generar_nombre_articulo()
RETURNS TRIGGER AS $$
DECLARE
  v_marca TEXT;
BEGIN
  SELECT nombre INTO v_marca FROM marcas WHERE id = NEW.marca_id;
  NEW.nombre := NEW.nombre_base
    || CASE WHEN NEW.atributo_valor IS NOT NULL AND NEW.atributo_valor <> ''
            THEN ' - ' || NEW.atributo_valor ELSE '' END
    || CASE WHEN v_marca IS NOT NULL THEN ' - ' || v_marca ELSE '' END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_nombre_articulo
BEFORE INSERT OR UPDATE OF nombre_base, atributo_valor, marca_id ON articulos
FOR EACH ROW
WHEN (NEW.nombre_base IS NOT NULL)
EXECUTE FUNCTION fn_generar_nombre_articulo();
```
El `WHEN (NEW.nombre_base IS NOT NULL)` es clave: no toca los artículos que todavía no tienen `nombre_base` cargado (la mayoría del catálogo, fuera de los rubros migrados).

**Verificado antes de usar `sabor_id` en cualquier `UPDATE`:** `articulos` no tiene ningún `UNIQUE` sobre `nombre` a nivel base de datos (ni constraint ni índice) — la validación de "nombre repetido" vive únicamente en el código de `ArticuloForm.tsx`, específico del flujo de Duplicar (ver Bloque 4).

### Bloque 2 — Migración de rubros (mecanismo: Excel + `UPDATE` en lote por `id`)

Mecanismo repetido para cada rubro: `SELECT` con `id, nombre, marca, nombre_base, atributo_valor AS nombre_comercial_sabor, '' AS sabor_estandar` → Ariel completa a mano en Excel → revisión (duplicados de nombre final, sabores nuevos, filas con `nombre_comercial_sabor` vacío, errores de tipeo) → `UPDATE ... FROM (VALUES ...) JOIN sabores` por lote, separado por rubro para poder ubicar fácil si algo falla.

**Proteínas (74 artículos)** — primer rubro piloto:
- 9 filas quedaron con `nombre_comercial_sabor` vacío (4 de Neix Reloaded + 5 sueltas) — inferidas con confianza a partir del `nombre` original de cada una (el sufijo después del sabor coincidía exacto con el patrón del resto).
- Sabor nuevo detectado: Café (de "Golden Coffee", Neix Reloaded).
- `atributo_nombre` (el campo "Sabor" que acompaña a `atributo_valor`) se completó después con `UPDATE ... WHERE sabor_id IS NOT NULL AND atributo_nombre IS NULL` → `'Sabor'`, al notar que había quedado vacío en el primer lote.
- 2 nombres duplicados preexistentes detectados ("Energy Gel - Lemon Sublime", "Bcaa 2000 - 120 Cápsulas") — **no** son de Proteínas, son arrastre de la carga inicial del catálogo (antes de que existiera la validación de duplicados en el alta). El primero se resolvió solo al dar de baja GU Energy (Bloque 3); el segundo sigue pendiente (ver sección 6).

**Creatinas (32 artículos)** — la primera exportación de Ariel trajo solo 15 de 32 filas (recorte del editor de SQL de Supabase, no un problema de datos); se completó con una segunda tanda de 17. Sabores nuevos: Naranja, Multifrutas (confirmado como sabor distinto de Frutos Rojos), Ananá, Uva. Convención "DP"/"Dp" en el nombre original → se unificó a "Doypack" completo en `nombre_base`, a pedido de Ariel, para que quede uniforme con el resto.

**Barras de proteína (43 de 53 activos — las 10 restantes ya se habían hecho antes, ver más abajo)**:
- Detectado con fotos reales del local: una misma marca puede tener **más de una línea de producto** (ej. Gentech "Low Carb Protein Bar" vs "Ironbar Energy Protein"; Pônt "SmartBased Protein Bar" vs "SmartBased Energy Bar" — nombres y composición nutricional distintos, no son sabores del mismo producto). Regla general adoptada: `nombre_base` = nombre real de la línea tal como está impreso en la caja, nunca un genérico por marca.
- Bug propio: 4 filas de Laddubar quedaron con el sabor y la marca ya incluidos dentro de `nombre_base` (se habría duplicado con el trigger) — corregido a `nombre_base = "Protein Bar"` compartido.
- Sabores nuevos: Maracuyá, Menta, Pistacho, Almendras, Avellana, Manzana, Caramelo, Cereza.
- Caso Pont id 950 ("Energy Vegana"): el nombre comercial no es un sabor sino una característica del producto (línea apta vegana, con varios ingredientes mezclados) — se dejó `sabor_id = NULL` a propósito en vez de forzar un sabor incierto.

**Resolución del tema "unidad vs. caja" (10 artículos ENA, ids 903-912):** mismo producto vendido suelto en el local y por caja de 16 para la (futura) web. Resuelto sin tocar el modelo de stock (Ariel confirmó que jamás carga stock por caja, siempre por unidad suelta, incluso cuando compra cajas cerradas) — cada presentación es un `nombre_base` distinto (`"Protein Bar"` vs `"Protein Bar - Caja 16 Unidades"`), con `disponible_local`/`disponible_web` cruzados entre ambas. Mismo patrón después aplicado a Fit Bar Crunch (caja 10u), Ironbar (caja 20u) y Whey Protein Bar Mervick (caja 12u).

**Geles (71 artículos, quedaron 59 activos migrados)**:
- Se fusionaron los rubros "Geles" y "Geles Cafeina" en uno solo (**"Geles"**) — la diferencia de cafeína pasó a modelarse con una tabla de componentes en vez de un rubro aparte (ver Bloque 3), porque un rubro es una categoría, no un atributo.
- Bugs propios encontrados y corregidos en el Excel: fila de Iron Gel (Gentech) con el sabor de la fila de arriba copiado por error (Frutos Rojos → debía ser Lima Limón/Limón); 6 pares de artículos de GU Energy que hubieran quedado con nombre idéntico tras la migración (resuelto de raíz dando de baja toda la marca, ver Bloque 3).
- Sabores nuevos: Citrus, Mango, Arándano.

**Bebidas Isotónicas (31 artículos, quedaron 19 activos)**:
- Bug propio: dos filas (Hydromax Doypack 600g Manzana/Naranja) con el sabor cruzado entre sí — corregido.
- Confirmado por Ariel: peso real "660 gr" (no un typo, el nombre viejo decía "600 Gr" pero el producto nuevo pesa distinto).
- 12 de las 31 filas venían marcadas por Ariel como discontinuadas ("Ya no viene más este formato" / "No creo que lo vuelva a comprar") — desactivadas (`activo=false`, nunca `DELETE`) junto con la migración.
- Sabor nuevo: Pomelo.

### Bloque 3 — Componentes (filtro "¿tenés algo con X?") + baja de GU Energy

A raíz de la duda de cómo diferenciar Geles con/sin cafeína, surgió una mejora más general: poder responder "¿tenés algo con Resveratrol / Vitamina D / Arginina?" sin necesitar una columna por cada posible ingrediente. Se armó como tabla de lista controlada + tabla puente (mismo patrón que `sabores`), con las 4 políticas RLS + GRANT desde el arranque (a diferencia de `sabores`, para no repetir el mismo bug):

```sql
CREATE TABLE componentes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE articulo_componentes (
  articulo_id BIGINT NOT NULL REFERENCES articulos(id),
  componente_id BIGINT NOT NULL REFERENCES componentes(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (articulo_id, componente_id)
);
```
Hoy solo tiene cargado **Cafeína** (los 41 artículos que venían del viejo rubro "Geles Cafeina"). Ariel confirmó casos reales para cuando se trabaje Colágenos: tiene un Resveratrol solo y varios Colágenos que también lo llevan. Guarda "tiene/no tiene", no dosis — si en algún momento hace falta dosis, se agrega una columna a la tabla puente sin romper nada.

**Baja completa de la marca GU Energy:** Ariel no la vende hace 2 años salvo un único artículo que sigue teniendo físicamente (id **1302**, "Hydration Drink - Orange"). Se desactivó toda la marca salvo ese id, con un solo `UPDATE` por `marca_id` (no por lista de ids a mano, para no dejar ninguna suelta en un rubro no revisado — apareció una en Bebidas Isotónicas y tres en Sales que no estaban en el radar):
```sql
UPDATE articulos SET activo = false
WHERE marca_id = (SELECT id FROM marcas WHERE nombre = 'GU Energy') AND id <> 1302;
```

### Bloque 4 — `ArticuloForm.tsx`: Sabor en Identificación, Nombre automático, fix de Duplicar

- **Nombre** pasa a ser de **solo lectura** cuando el artículo tiene `nombre_base` cargado — se arma solo (mismo cálculo que el trigger) y se ve en vivo al cambiar Nombre base, Sabor o Marca, sin cambiar de pestaña. Si no hay `nombre_base` (catálogo todavía sin migrar), sigue editable a mano como siempre.
- **Nombre base**, **Sabor** (select nuevo, conectado a `sabores`) y **Nombre comercial del sabor** (el viejo "Atributo valor", renombrado) se movieron de la solapa "Web y extras" a **Identificación**, a pedido de Ariel, para verlos todos juntos con Marca mientras arma el nombre.
- **Atributo nombre** (el campo libre que decía "Sabor" a mano) se sacó del formulario — ahora se fija solo en `'Sabor'` al guardar, si hay `sabor_id` elegido.
- **Elegir un Sabor autocompleta "Nombre comercial del sabor"** con ese mismo texto (encadenando Sabor → Nombre comercial → Nombre) — editable después a mano si el nombre real de fábrica difiere (ej. "Vanilla Punch" en vez de "Vainilla").
- **Fix de un gap real:** "Duplicar artículo" no copiaba `nombre_base` (a propósito, para forzar a cambiar algo) — pero eso significaba que cada alta por duplicado nacía sin agrupar en la glosa hasta completar los datos a mano. Ahora: **sí copia `nombre_base`**, deja `Sabor` vacío, y **bloquea el guardado** si no se elige un Sabor o si se elige el mismo que tenía el artículo origen (para productos sin sistema de sabor todavía, se mantiene la validación vieja por nombre completo).

### Bloque 5 — Feature nueva: Glosa de precios (`articulos/page.tsx`)

Botón **"Generar glosa"** junto a "+ Nuevo artículo" en Administrar Artículos — habilitado solo si hay al menos un filtro real aplicado (Rubro, Marca o Búsqueda; Disponibilidad/Stock no cuentan porque no eligen productos, solo su estado), para no poder generarla sobre el catálogo completo por accidente.

Al generar: toma lo que ya está filtrado en pantalla + 2 reglas fijas de negocio que no dependen de los filtros — **solo artículos con stock real** y **nunca las presentaciones "Caja X Unidades"** (`disponible_local=true` siempre). Agrupa por Nombre base + Marca, junta los sabores en stock ordenados alfabéticamente, y si hay diferencia de precio entre sabores del mismo grupo muestra el menor. Formato calcado del que Ariel ya usaba a mano por WhatsApp, con marca y precio en negrita:
```
*Proteinas*
- *Body Advance* - Whey Protein + Creatina + Glutamina - 1 kg - Chocolate, Frutos Rojos *$ 39.000*
```
Los artículos de rubros todavía sin migrar aparecen igual (como línea suelta con su nombre completo, sin agrupar) — el listado no se rompe, simplemente no agrupa hasta que se le haga el mismo trabajo que a los 5 rubros de hoy. Probado en vivo por Ariel contra un mensaje real ya enviado por WhatsApp (Proteínas y Creatinas) — formato aprobado.

### Archivos modificados en esta sesión (para actualizar `MAPA-ARCHIVOS.md`)
- `src/components/articulos/ArticuloForm.tsx` — Sabor + Nombre comercial del sabor movidos a Identificación, Nombre de solo lectura autogenerado, autocompletar Nombre comercial al elegir Sabor, fix de Duplicar (copia `nombre_base`, exige Sabor distinto).
- `src/app/(sistema)/articulos/page.tsx` — botón "Generar glosa" + modal, query ampliada con `nombre_base`, `sabor_id`, `atributo_valor` y join a `sabores`.

### Pendiente para la próxima sesión
1. Seguir migrando rubros al sistema de Sabores — Salud y bienestar, Shakers, Pre-entrenamiento, Colágenos son los siguientes por volumen.
2. Resolver el duplicado "Bcaa 2000 - 120 Cápsulas" (2 ids activos).
3. Diseño de "Medida"/"Cantidad" (Gr/Kg/Lb/Cápsulas + cantidad numérica) para filtros de la vitrina web — conversado, sin tabla `tipos_medida` creada todavía.
4. Sumar componentes nuevos (Taurina, Arginina, Citrulina, Beta-Alanina, Resveratrol) cuando se migren Pre-entrenamiento/Óxido Nítrico/Colágenos.
5. Actualizar `MAPA-ARCHIVOS.md` y `CLAUDE_CODE_PROMPT.md` con todo lo de esta sesión (tablas nuevas, columna `sabor_id`, trigger, archivos modificados).
6. Seguir con los pendientes de sesiones previas sin tocar hoy (diagnóstico de rechazo ARCA, reintento de fiscalización, filtros de Historial de cajas, permisos de Agustín, NC real, sandbox — ver sección 6).

---

## 23. Sesión 27-29/07/2026 — Fiscalización manual, incidente de producción, y Obligaciones (cuenta corriente de deuda)

### Bloque 1 — Factura real a la Municipalidad de Cinco Saltos (venta #1401)

Venta del 21/07 en Efectivo (nunca fiscaliza por default) que se dejó Guardada; al ir a facturarla el 27/07 se descubrió que ARCA solo permite backdatear comprobantes de **bienes hasta 5 días** — 6 días de diferencia ya estaba fuera de rango, y además ya había comprobantes reales emitidos con fecha posterior en el mismo punto de venta (bloquea por orden cronológico). Se facturó con fecha real del día (27/07) por el portal web de TusFacturasAPP, no por la API.

Se cargó a la Municipalidad como **cliente real** (antes todo pasaba por Consumidor Final id=1) usando el domicilio de una factura vieja de Cover (más confiable que el sello, que decía otra dirección), con cuenta corriente a 15 días (Cover tenía 30, se acordó achicar). `clientes.id=2`.

### Bloque 2 — Pantalla nueva: Fiscalización (reintento manual)

Antes de esto, una venta que fallaba la fiscalización automática quedaba sin ningún lugar en la UI para reintentarla — había que reconstruir todo a mano por SQL (como se hizo con la venta #1398 en sesión anterior). Se armó:

- **`lib/tusfacturas/fiscalizar.ts`** (nuevo): todo el pipeline de fiscalización que antes vivía duplicado en `api/ventas/route.ts`, ahora en un solo lugar. Si ya existe un `comprobante` para la venta (reintento tras rechazo), reutiliza el mismo número ya reservado — nunca pide uno nuevo para la misma venta. Guarda el motivo real de rechazo en `comprobantes.mensaje_error` (columna nueva) tanto si rechaza ARCA como si hay un error de red/sistema.
- **`api/ventas/route.ts`** se simplificó mucho — ahora solo llama a `fiscalizarVenta()`.
- **`api/fiscalizacion/route.ts`** (nuevo): endpoint que usa la pantalla manual, protegido por rol Admin.
- **`/fiscalizacion`** (nuevo, en el menú): lista ventas Guardadas sin fiscalizar o Rechazadas, con selector de Cliente (de la tabla `clientes`) y — solo si el cliente elegido tiene cuenta corriente — selector Contado/Cuenta corriente. Botón Fiscalizar/Reintentar. Filtros **Rechazadas/Error | Sin fiscalizar | Todas** (en ese orden, con Rechazadas/Error como default — es lo que se revisa a diario).
- **`lib/tusfacturas/mapeo.ts` y `tipos.ts`**: dejaron de asumir Consumidor Final fijo. Resuelven la condición de IVA real del cliente (`CF`/`RI`/`M`/`E`, tabla de referencia oficial TusFacturasAPP) y la condición de pago real (`201`=Contado, o el código según los días de plazo de cta. cte. — `207` para 15 días, `205` genérico si el plazo no es uno de los estándar), con el vencimiento del comprobante calculado según corresponda.

### Bloque 3 — Incidente real de producción: fiscalización automática rota unas horas

El deploy del Bloque 2 rompió la fiscalización automática del POS (ventas #1414 a #1423 quedaron todas "Pend. fiscal") — el nuevo `JOIN` a `condiciones_iva` (necesario para resolver Exento/RI/Monotributo) destapó que esa tabla, junto con `localidades` y `tipos_cliente` (viejas, preexistentes, nunca antes consultadas por el pipeline), **no tenían `GRANT SELECT` para `authenticated`** — mismo patrón de siempre al tocar una tabla por primera vez, pero esta vez en tablas que ya existían de antes, no una tabla recién creada. Diagnosticado confirmando que **no se llegó a crear ninguna fila en `comprobantes`** para esas ventas (o sea, falló antes de intentar contactar a TusFacturasAPP). Corregido con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy + `GRANT SELECT` en las 3 tablas. Las ventas afectadas se reintentaron desde `/fiscalizacion` sin perder numeración real.

**Lección para futuras sesiones:** verificar RLS + GRANT explícitamente antes de sumar un `JOIN` nuevo a cualquier tabla, incluso si esa tabla es vieja y "ya debería estar bien".

### Bloque 4 — Numeración desincronizada tras emitir a mano

Al emitir la factura de la Municipalidad por el portal web (Bloque 1) en vez de por la API, `numeracion_comprobantes.ultimo_numero` se quedó en 30 mientras que ARCA ya tenía el 31 real usado. Corregido con `UPDATE` puntual a 31 antes de la próxima fiscalización por sistema (que pidió correctamente el 32).

### Bloque 5 — Bug real corregido: `descuento_pct` de Compras nunca se guardaba

Se encontró editando la Orden #10 de Black Suplementos (ver Bloque 6): el `SELECT` que carga una orden y el `INSERT` que la guarda **nunca incluían la columna `descuento_pct`** de `orden_compra_items`, ni en `compras/nueva/page.tsx` ni en `compras/[id]/page.tsx` — el subtotal en pantalla se calculaba bien en el momento, pero el porcentaje en sí nunca llegaba a la base. Afecta a **cualquier orden cargada con descuento desde que existe la pantalla**, no solo a la que lo destapó. Corregido en los dos archivos (columna sumada al `SELECT` y al `INSERT`).

### Bloque 6 — Orden de Compra #10 (Black Suplementos) ampliada después de guardada

Pedido inicial $447.910,20 (Borrador, transferencia real del 27/07), ampliado telefónicamente el mismo día a $712.428,06 con descuento retroactivo del proveedor por superar $700.000 (aplicado de forma no uniforme: algunos ítems bajaron precio unitario, otros ganaron % de bonificación, uno quedó igual). Como la orden ya había generado un movimiento financiero real (`sincronizarMovimiento` colapsa a **una sola fila** por orden+subtipo), se decidió conscientemente la **Opción A**: dejar que el movimiento se actualice al total nuevo con la fecha original (27/07) — no rompe la conciliación de caja (es transferencia, no efectivo) ni el total mensual (mismo mes). La alternativa de partir en dos filas reales (una por transferencia real) se descartó por ser frágil: se habría vuelto a colapsar en la próxima edición de la misma orden.

### Bloque 7 — Movimientos: "Período" vs. "Fecha" — con una corrección importante en el camino

Se agregó un campo **Período** (mes, separado de Fecha) para poder registrar pagos atrasados (típicamente impuestos) sin perder de vista a qué mes correspondían en realidad. **Primer intento incorrecto:** se hizo que `mes_contable` (el campo que alimenta el Dashboard y Reportes) siguiera al Período en vez de a la Fecha — esto es devengado contable, y este sistema viene siendo de **caja real** desde el día uno. Se aplicó sobre 13 movimientos reales de sueldos de junio (pagados en julio), lo que hizo que julio mostrara una diferencia positiva falsa (+$342.039,63 en vez de la negativa real de más de $1,6M). Detectado por Ariel comparando contra el número que ya conocía de memoria. **Corregido:** `mes_contable` vuelve a seguir siempre a la Fecha real de pago; "Período" queda como campo de **referencia informativa únicamente** (útil para saber "este pago es del F.931 de junio" mirando el detalle), sin mover un peso de mes en ningún reporte. Los 13 movimientos se revirtieron a `mes_contable` = julio.

### Bloque 8 — Movimientos: Fecha de vencimiento + ocultar Período/Vencimiento en Caja

Columna nueva `movimientos.fecha_vencimiento` (opcional). Ambos campos (Período y Vencimiento) se ocultan del formulario cuando la Categoría elegida es "Caja" (Ingreso/Retiro) — no son gastos con período propio, son solo mover plata de lugar.

### Bloque 9 — Validación nueva: Efectivo sin caja abierta

Se confirmó que no existía ninguna validación — un movimiento en Efectivo se podía guardar con la caja cerrada, quedando con `cierre_turno_id = null` y **sin sumarse nunca a ninguna conciliación de turno** (plata real que el sistema nunca iba a contar). Se agregó: aviso en vivo apenas se elige Efectivo sin turno abierto, y bloqueo real al intentar guardar. No afecta a ningún otro medio de pago.

### Bloque 10 — Feature nueva grande: Obligaciones (cuenta corriente de deuda por acreedor)

Objetivo: poder agendar lo que hay que pagar (impuestos, sueldos, servicios, profesionales) sin que cuente como gasto real hasta confirmarlo, y ver de un vistazo qué se debe a cada uno — calcado del mecanismo que Ariel ya llevaba a mano en Excel (columnas Fecha / Nº factura / Importe factura / Importe recibo / Saldo).

```sql
CREATE TABLE acreedores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria_gasto_id BIGINT NOT NULL REFERENCES categorias_gasto(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE obligaciones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acreedor_id BIGINT NOT NULL REFERENCES acreedores(id),
  categoria_gasto_id BIGINT NOT NULL REFERENCES categorias_gasto(id),
  concepto_gasto_id BIGINT NOT NULL REFERENCES conceptos_gasto(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('Cargo','Pago')),
  monto NUMERIC NOT NULL,
  periodo DATE,                -- solo Cargo, mes al que corresponde (referencia)
  fecha_vencimiento DATE,      -- solo Cargo
  numero_comprobante TEXT,
  fecha_pago DATE,             -- solo Pago
  medio_pago_id BIGINT REFERENCES medios_pago(id),
  movimiento_id BIGINT REFERENCES movimientos(id),  -- se completa recién al pagar
  observaciones TEXT,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  anulado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla puente: qué conceptos puede usar cada acreedor (no alcanza con la
-- categoría — "Servicios" tiene 5 conceptos pero Aguas Rionegrinas solo usa uno)
CREATE TABLE acreedor_conceptos (
  acreedor_id BIGINT NOT NULL REFERENCES acreedores(id),
  concepto_gasto_id BIGINT NOT NULL REFERENCES conceptos_gasto(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (acreedor_id, concepto_gasto_id)
);
```

**Saldo de cada acreedor:** suma de Cargos menos suma de Pagos, calculado siempre al vuelo en la pantalla — nunca se guarda, para que no se pueda desalinear.

**Categoría nueva:** `Profesionales` (para el Contador). **Conceptos nuevos:** `Honorarios Contador`, `SAC` (separado de `Sueldo` — en Argentina se paga en junio y diciembre, mismo criterio de "no evidenciar" que con Sueldo: formal + informal van bajo el mismo concepto). Se **unificaron nombres** de 3 conceptos de Servicios para que coincidan con el acreedor real: `Agua`→`Aguas Rionegrinas`, `Gas Camuzzi`→`Camuzzi Gas`, `Luz EDERSA`→`Edersa`.

**Pantalla `/obligaciones`:** categorías como tarjetas colapsables — cerradas por default; tocar una categoría puntual la auto-abre; tocar "Todas" fuerza a cerrar todas de nuevo (decidido explícitamente por Ariel tras probarlo). Filtro por categoría. Cada acreedor expandible con su detalle Cargo/Pago/Saldo corrido. Botones **"+ Nuevo cargo"** (registra deuda, no toca `movimientos`) y **"+ Registrar pago"** (total o parcial — genera el Egreso real en `movimientos` y lo enlaza vía `movimiento_id`). Los inputs de Monto tenían el bug de no formatear miles/decimales (corregido, mismo patrón `parsearMonto`/buffer de texto que el resto del sistema).

**16 acreedores cargados**, con vínculos reales en `acreedor_conceptos`:
- **Empleados:** Agustín Chandía (Sueldo, SAC), Fabiana (Limpieza)
- **Impuestos:** AFIP (F931, AFIP Monotributo), FAECYS, INACAP, OSECAC, Sindicato
- **Profesionales:** Juan Fernando Arévalo (Contador)
- **Servicios:** Aguas Rionegrinas, Camuzzi Gas, Edersa, Claro
- **Local Comercial:** Alquiler
- **Marketing:** Canva
- **Página Web:** Empretienda
- **Sistema:** TusFacturasAPP

**Historial real migrado** (no inventado): sueldos de junio de Agustín (4 cargos: Sueldo con recibo/Adicional, SAC Recibo/Adicional, $1.688.211 total) y Fabiana (1 cargo Limpieza, $260.000, con "16 horas" en observaciones), con sus 13 pagos parciales reales **enlazados a los `movimiento_id` que ya existían** en la base (nunca se insertó un movimiento nuevo) — verificado con `SELECT` antes de armar cada `INSERT`, nunca a ids supuestos. Mismo mecanismo aplicado después a Claro, Canva, Empretienda y TusFacturasAPP (1 cargo + 1 pago cada uno, enlazados a sus movimientos reales de julio).

### Bloque 11 — Consulta reusable: "qué se pagó y no está en Obligaciones"

```sql
SELECT cat.nombre AS categoria, c.nombre AS concepto,
       COUNT(*) AS cantidad_movimientos, SUM(m.monto) AS total
FROM movimientos m
JOIN categorias_gasto cat ON cat.id = m.categoria_gasto_id
JOIN conceptos_gasto c ON c.id = m.concepto_gasto_id
WHERE m.tipo = 'Egreso'
  AND m.anulado = false
  AND cat.nombre NOT IN ('Compras Mercadería', 'Caja')  -- eso vive en Compras / es solo mover plata de lugar
  AND NOT EXISTS (SELECT 1 FROM obligaciones o WHERE o.movimiento_id = m.id)
GROUP BY cat.nombre, c.nombre
ORDER BY cat.nombre, c.nombre;
```
Decidido explícitamente: **Insumos** (Artículos de limpieza, Bolsas/Packaging) se queda afuera de Obligaciones a propósito — no tienen un proveedor fijo al que "deberle" algo.

### Archivos nuevos o modificados en esta sesión (para `MAPA-ARCHIVOS.md`)
- `src/app/(sistema)/fiscalizacion/page.tsx` — **nuevo**
- `src/app/api/fiscalizacion/route.ts` — **nuevo**
- `src/lib/tusfacturas/fiscalizar.ts` — **nuevo**
- `src/app/(sistema)/obligaciones/page.tsx` — **nuevo**
- `src/app/api/ventas/route.ts` — simplificado, usa `fiscalizarVenta()`
- `src/lib/tusfacturas/mapeo.ts`, `tipos.ts` — condición de IVA/pago reales, ya no asumen Consumidor Final
- `src/app/(sistema)/compras/nueva/page.tsx`, `compras/[id]/page.tsx` — fix `descuento_pct`
- `src/components/movimientos/MovimientoForm.tsx` — campos Período/Fecha de vencimiento, ocultos en Caja, bloqueo de Efectivo sin turno abierto
- `src/components/layout/Sidebar.tsx` — se sumaron "Fiscalización" y "Obligaciones" al menú

### Pendiente para la próxima sesión
1. Seguir sumando acreedores a Obligaciones a medida que aparezcan (consulta del Bloque 11).
2. Evaluar reintento **automático** de fiscalización (hoy el reintento es manual, desde `/fiscalizacion`).
3. Replicar en sandbox la fiscalización manual + tablas de Obligaciones.
4. Seguir con los pendientes de sesiones previas (permisos de Agustín, NC real, migración de rubros de Sabores, tabla `tipos_medida` — ver sección 6).

---

## 24. Sesión 30/07 - 03/08/2026 — Dashboard/Reportes con costo real, filtros por defecto, primera fiscalización real end-to-end

### Bloque 1 — Costo real por venta (base de todo lo demás de esta sesión)

Columna nueva `venta_items.costo_unitario`: cada venta graba el costo real del artículo en el momento exacto de la venta, para que el margen de una venta ya cerrada no cambie después aunque el costo se actualice con compras futuras. Backfill de las 232 ventas existentes con el costo actual (aproximación válida — primer mes del sistema). Además, costo promedio ponderado al confirmar una Orden de Compra (antes se reemplazaba directo por el costo de la compra más reciente). **Aviso importante:** el costo de mercadería de las ventas anteriores al 30/07 sigue siendo una aproximación (costo del artículo al momento del backfill, no el real de esa fecha); desde el 30/07 es exacto.

### Bloque 2 — Dashboard: Utilidad Bruta/Neta reales, Ventas del día + Caja fusionados, diseño 3D

- **Utilidad Bruta** = Ventas − costo real (`costo_unitario`). **Utilidad Neta** = Bruta − gastos fijos reales del mes en curso (misma exclusión que Punto de Equilibrio: sin Compras Mercadería ni Retiro de caja). Reemplaza el 40% fijo que Ariel usaba en su Excel.
- **Ventas del día** pasó de 3 tarjetas + banner de Caja aparte, a **una sola fila de 4 tarjetas** (Mañana / Tarde / Total del día / Caja) — Caja a la derecha a propósito, para mantener el orden de lectura de ventas primero. Cada tarjeta de turno ahora también muestra el acumulado mensual de ese turno. Se sacó el donut "Por turno" (esa info ya está en las tarjetas de arriba).
- **Las 3 de venta + Caja son clickeables**: Mañana/Tarde/Total redirigen a `/ventas/registro?turno=1|2|todos` (Registro de Ventas lee el parámetro con `window.location.search`, mismo patrón que `ArticuloForm.tsx`, para no forzar Suspense boundary — y tiene prioridad sobre la auto-detección del turno activo de caja). Caja redirige a `/cierre-turno`.
- **Ingresos/Egresos/Diferencia** ahora excluyen `categoria_gasto_id=13` (Retiro/Ingreso manual de Caja) — no son ingreso ni gasto real del negocio, solo mueven plata de lugar (misma exclusión que ya tenía el checkbox de Movimientos). Antes el Egresos del Dashboard no coincidía con lo que Ariel esperaba como gasto real, por incluir los retiros.
- **Diseño 3D** en las 10 tarjetas (Ventas del día ×4 + resumen del mes ×6): sombra doble (chica+difusa), hover con `-translate-y` y sombra más grande en las clickeables, press al click. Bordes aclarados en las tarjetas blancas para que la sombra se note más.
- Ícono de Utilidad Bruta/Neta cambiado de `%` a `Wallet` (el valor se muestra en $, no en %).

### Bloque 3 — Pantalla nueva: Reportes

`reportes/page.tsx`, antes vacía. Dos gráficos (Recharts) con filtro de Año compartido (+ opción "Todo el histórico"):
- **Ventas mensuales**: barras + línea de **Punto de Equilibrio real** calculado mes a mes (gastos fijos reales de ese mes ÷ margen real de ese mes) — no un número fijo a mano como en el Excel viejo.
- **Utilidad mensual**: 3 barras por mes (Bruta / Gastos fijos / Neta), mismo orden que el Excel de Ariel — Gastos fijos se agregó después de una pregunta directa de Ariel ("¿por qué solo 2 columnas si mi Excel tiene 3?"), a pesar de ser matemáticamente redundante con Neta, porque ayuda a ver cuánto se come cada mes.
- Leyenda del segundo gráfico armada a mano con `content` (no `payload`, esa versión de Recharts no lo permite en el tipo) para forzar el mismo orden que las barras.
- Nota fija en pantalla sobre la aproximación del costo histórico pre-30/07 (Bloque 1).

### Bloque 4 — Registro de Ventas: turno por URL, reset a Todos en Mes/Año, contador sin anuladas

- Lee `?turno=` de la URL al montar (ver Bloque 2). Al elegir período **Mes** o **Año**, el filtro de Turno se resetea solo a "Todos" — el turno no tiene sentido en esos períodos (encontrado por Ariel viendo una combinación rara "Julio 2026 + Turno Tarde" que venía de una tarjeta del Dashboard).
- El contador "X ventas" del encabezado del listado ahora **excluye anuladas**, igual que la tarjeta "Cantidad" (antes contaban distinto — 78 vs 77 — por criterios distintos sin que se notara). El listado de abajo sigue mostrando todas, anuladas incluidas.

### Bloque 5 — Movimientos: Período/Vencimiento restringido, filtros por defecto, recategorización

- **`MovimientoForm.tsx`**: Período y Fecha de vencimiento antes se mostraban para **todas** las categorías salvo Caja (lógica de exclusión al revés). Ahora es una lista de inclusión: solo **Impuestos, Empleados y Servicios** — las únicas con obligaciones recurrentes/formales. Encontrado por Ariel al ver esos campos en una compra de Local Comercial → Mantenimiento (lámparas LED) donde no correspondían.
- **Alquiler recategorizado** de Local Comercial a Servicios (concepto `id=1` y acreedor `id=12`, `UPDATE` directo en ambas tablas) — dentro de Local Comercial convivía con Mantenimiento, que no necesita Período/Vencimiento; Servicios ya agrupa los otros pagos fijos mensuales (Edersa, Camuzzi, Aguas Rionegrinas, Internet, Claro), mismo tipo de gasto que Alquiler. Como Obligaciones agrupa por `acreedores.categoria_gasto_id` (no por el concepto), hubo que mover el acreedor aparte del concepto.
- **Concepto nuevo:** `Supermercado` bajo categoría Insumos (`id=15`).
- **Filtro de período por defecto** en `movimientos/page.tsx`: pasó de "Todos" a **"Mes"** — con el sistema ya en su segundo mes real, "Todos" dejó de ser útil de entrada.
- **Filtro de Estado por defecto** en `compras/page.tsx`: pasó de "Todos" a **"Borrador"** — a Ariel le interesa ver de entrada los pedidos pendientes por llegar.

### Bloque 6 — Primera fiscalización real completa (ventas #1437-#1440, PV 0004)

Prueba real en producción, sin tocar código: **#1437 y #1438 fiscalizadas con éxito** (número 48 y 49). **#1439** rechazada en su primer intento porque ARCA esperaba el 49 (que #1438 todavía no había confirmado) — comportamiento esperado del sistema, no un bug: `fiscalizar.ts` reutiliza siempre el mismo número ya reservado por venta en cada reintento, nunca pide uno nuevo. **#1438** también tuvo un rechazo transitorio propio de los servicios web de ARCA (no de numeración), resuelto solo reintentando. Reintentando en el orden correcto (48→49→50→51) las 4 quedaron **Fiscalizadas**.

A partir de esta prueba, se agregó una **advertencia (no bloqueante)** en `/fiscalizacion`: si el comprobante de una venta tiene un comprobante anterior (número menor, mismo `punto_venta_id`) que todavía no tiene CAE confirmado, se avisa antes de reintentar, para evitar el error de numeración de #1439 por apuro o desconocimiento.

### Archivos nuevos o modificados en esta sesión (para `MAPA-ARCHIVOS.md`)
- `src/app/(sistema)/dashboard/page.tsx` — Utilidad Bruta/Neta reales, fila de 4 tarjetas Ventas del día+Caja clickeables, diseño 3D, Ingresos/Egresos/Diferencia sin movimientos de Caja
- `src/app/(sistema)/reportes/page.tsx` — **nuevo completo**, antes solo el título
- `src/app/(sistema)/ventas/registro/page.tsx` — lee `?turno=` de URL, reset a Todos en Mes/Año, contador sin anuladas
- `src/app/(sistema)/movimientos/page.tsx` — filtro de período por defecto "Mes"
- `src/app/(sistema)/compras/page.tsx` — filtro de estado por defecto "Borrador"
- `src/app/(sistema)/fiscalizacion/page.tsx` — advertencia de comprobante anterior sin CAE confirmado
- `src/components/movimientos/MovimientoForm.tsx` — Período/Vencimiento restringido a Impuestos/Empleados/Servicios
- `src/app/(sistema)/compras/nueva/page.tsx`, `compras/[id]/page.tsx` — costo promedio ponderado al confirmar OC

### Pendiente para la próxima sesión
1. Pantalla "Correcciones" para Admin (turnos cerrados) — sigue sin construir.
2. Evaluar reintento automático de fiscalización, y si la advertencia de orden conviene que bloquee en vez de solo avisar.
3. Replicar en sandbox: fiscalización manual + Obligaciones (sesión 23) + Alquiler/Supermercado/Período-Vencimiento (sesión 24).
4. Seguir con los pendientes de sesiones previas sin tocar hoy (NC real, permisos de Agustín, migración de rubros de Sabores — ver sección 6).

---

## 25. Sesión 05/08/2026 — Fix de fondo del costo real (IVA), borradores de venta, y planificación de la Vitrina web

### Bloque 1 — El bug de IVA: hallazgo y switch central

Revisando por qué tuvo que corregir a mano el costo de un Collagen, Ariel encontró que **compras/nueva** dividía el precio cargado por 1,21 (IVA) para calcular `costo_sin_iva`, sin importar si el proveedor realmente facturaba con IVA discriminado. Con comprobantes reales de Black Suplementos y DisFit (ambos monotributistas, 0% IVA / "Comprobante No Válido como Factura") se confirmó el problema.

**Decisión clave de Ariel** (la que define el criterio para siempre, no solo hoy): mientras sea monotributista, el IVA que un proveedor le cobra **no se recupera** como crédito fiscal — es plata real que pagó y no vuelve. El costo real de cada compra es **el total efectivamente pagado**, discrimine IVA el proveedor o no. Por eso se creó:

```ts
// src/lib/config.ts
export const RECUPERA_IVA_COMPRAS = false
```

El día que pase a Responsable Inscripto, se cambia ese único valor a `true` y todo el sistema empieza a descontar IVA del costo — sin tocar Compras, Dashboard, Reportes ni Precios. Las compras ya cargadas antes del cambio **no se recalculan**: en su momento el IVA no era recuperable, así que ese fue su costo real para siempre.

**4 archivos corregidos** para usar el switch (antes cada uno tenía su propia cuenta de IVA, algunas hasta duplicadas — `ArticuloForm.tsx` dividía el costo Y volvía a dividir el precio de venta antes de calcular Utilidad %, doble error):
- `compras/nueva/page.tsx`, `compras/[id]/page.tsx` — `getDivisorIva()` centralizado, se sacó el checkbox "discrimina IVA" que se había agregado a mitad de sesión y después se volvió innecesario.
- `articulos/precios/page.tsx` — la columna "Costo c/IVA" volvía a sumarle IVA a un costo que ya podía ser el real; ahora es simplemente "Costo" mientras el switch esté en `false`.
- `ArticuloForm.tsx` — mismo criterio, más reordenamiento de la grilla de Precios (Tasa IVA a ancho completo con nota aclaratoria de que no afecta nada mientras el switch esté apagado).

`orden_compra_items.precio_unitario_con_iva` (columna nueva) y `proveedores.discrimina_iva` (columna nueva, sin uso activo en el cálculo, queda como dato informativo a futuro) se agregaron en el camino pero terminaron siendo redundantes una vez que apareció el criterio real del switch único.

### Bloque 2 — Corrección retroactiva de costos

Con la consulta de alcance ampliada a **todas** las órdenes confirmadas (no solo Black Suplementos/DisFit — apareció también EPN), se identificaron:
- **58 artículos** con una sola compra afectada y costo actual sin tocar después → corregidos con un único `UPDATE` (revierte la división de IVA de más).
- **1003/1004** (Collagen Plus/Sport) — Ariel ya los había corregido a mano antes de esta sesión, se dejaron como estaban.
- **6 artículos con cadena de compras múltiples** (1023, 1029, 1049, 1254, 1256, 1374) — al intentar reconstruir el promedio ponderado histórico se encontró que la **Orden 4** nunca generó ningún movimiento de stock para ningún artículo (0 filas en `movimientos_stock` con `origen_id=4`), y el costo/stock actual de esos 6 no coincidía con ninguna compra puntual. Se descartó reconstruir la cadena completa (edificar sobre datos con huecos reales) y en su lugar se fijó el costo de cada uno al valor corregido de su **compra confirmada más reciente**. El conteo físico real de Ariel confirmó que el **stock** de esos artículos estaba bien igual (una corrección manual sin origen registrado del 22/07 lo había dejado bien, aunque sin trazabilidad) — el problema real era solo de costo, no de cantidad.
- Se armó además un Excel de verificación de margen (Utilidad % antigua vs. corregida) antes de aplicar nada, para detectar artículos que quedaran con margen bajo tras la corrección.

**Pendiente sin resolver:** por qué la Orden 4 se salteó el paso de stock para esos 6 artículos — quedó sin investigar a fondo, no bloquea nada hoy.

### Bloque 3 — Feature: Guardar borrador de venta

A pedido de Ariel (Agustín tuvo que hacer una venta larga "a mano" porque el cliente tardó en volver con el efectivo, mientras atendía a otro cliente). Tabla nueva:

```sql
ventas_borrador (id, sucursal_id, cierre_turno_id, usuario_id, cliente_id, etiqueta, items JSONB, descuento_pct, creado_en)
```

En `ventas/page.tsx`: botón "Guardar borrador" (ícono, verde) pausa el carrito completo y lo limpia para la siguiente venta; botón "Borradores (N)" (ícono, junto al buscador) abre un popup con los borradores **de ese turno únicamente** (`cierre_turno_id`, nunca de otro día u otro turno), identificados por los productos que contienen (no solo la nota manual). El borrador elegido se carga al carrito pero **no se borra hasta que la venta se confirma de verdad** — cancelar la venta lo deja intacto en la lista (bug real encontrado y corregido en la primera prueba).

En `cierre-turno/page.tsx`: si quedan borradores del turno al cerrar caja, aparece un aviso con 3 opciones (volver a Ventas a resolverlos, eliminarlos y cerrar, o cerrar igual dejándolos — con advertencia de que quedarían huérfanos, porque la lista de Borradores de Ventas solo muestra los del turno activo).

### Bloque 4 — Obligaciones: vincular movimiento existente

Mismo espíritu que el Bloque 3 (evitar que un pago cargado "por el camino equivocado" se pierda o se duplique). El modal "Registrar pago" ahora tiene dos modos: "Nuevo movimiento" (como siempre) o **"Vincular movimiento existente"** — busca Egresos de la misma categoría sin vincular todavía a ninguna obligación, y al elegir uno precarga monto/fecha/medio de pago (bloqueados) sin crear un Egreso nuevo.

Aplicado a un caso real: Fabiana (Limpieza) tenía un pago de $105.500 cargado desde Movimientos por Agustín, sin cargo correspondiente ni vínculo. Se le agregó el cargo de julio (mes vencido, con `fecha_vencimiento=01/08` para que se ordene bien en la pantalla) y se vinculó el pago al movimiento #255 ya existente. De paso se unificaron sus conceptos históricos (tenía "Sueldo" mezclado con "Limpieza" — se sacó "Sueldo" de `acreedor_conceptos` para ese acreedor).

### Bloque 5 — Compras: número de OC visible

A pedido de Ariel (contó mal una orden a simple vista, sin el número visible, buscando la Orden 4 en la lista). Cada fila del listado ahora arranca con "OC #N" antes de la fecha.

### Bloque 6 — Exportación de Empretienda: descripciones de producto (en pausa, a propósito)

Ariel subió el export completo de Empretienda (369 productos, 367 con descripción real armada a mano, no solo la etiqueta legal). Se cruzó contra el catálogo de Habitus SD (471 artículos activos) con matching difuso (`rapidfuzz`, `token_sort_ratio`, con detección de marca sospechosa e IDs duplicados) y se armó un Excel de 3 hojas: **88 de alta confianza** (listos para aplicar), **207 a revisar** (score bueno pero no perfecto, o alguna señal de alerta), **74 sin match confiable** (probablemente discontinuados o marcas que Ariel ya no vende). **Decisión de Ariel: pausar esto a propósito** — no vale la pena revisar 369 productos de marcas que capaz ni sigan en el catálogo cuando la vitrina esté lista; se retoma más adelante, filtrando por categoría y stock real en ese momento. El Excel queda guardado (`revision_descripciones_empretienda.xlsx`) para no repetir el cruce.

### Bloque 7 — Planificación de la Vitrina web (sin código, conversación de diseño)

Decisiones tomadas, para no repetir la conversación:

1. **Alcance:** carrito + checkout completo, con pago online (Mercado Pago) — no solo catálogo informativo.
2. **Cómo entra un pedido:** la venta se crea sola en Habitus SD (con su fiscalización correspondiente). Requiere tener bien afinado el stock para no ofrecer online algo sin stock real.
3. **Stock por sucursal (pensando en escalar a futuro, ej. un local en Córdoba):** el modelo de datos **ya está preparado** — `articulo_stock` tiene `sucursal_id` desde su diseño original. Hoy solo existe la sucursal 1 (Cinco Saltos); el día que haya una segunda sucursal, no hace falta cambiar el esquema, solo que la vitrina consulte el stock filtrando por sucursal en vez de asumir una sola.
4. **Qué se muestra públicamente:** `disponible_web = true` **y** stock real > 0 → se muestra con precio; si no tiene stock, se muestra igual pero como "Sin stock" (no se oculta el producto).
5. **Envíos:** arranca **solo con retiro en el local**. Andreani y Correo Argentino (que sí tenía Empretienda) quedan pendientes para una etapa posterior.
6. **Fotos de producto:** no hay URLs cargadas en ningún lado (ni el sistema ni el export de Empretienda). Ariel las tiene guardadas localmente en distintas carpetas — las va a resubir manualmente, por categoría, a **Supabase Storage**. Trabajo manual, sin apuro.
7. **Infraestructura:** mismo proyecto Next.js, sección pública nueva sin login. Confirmado que `habitussd.com` y `sistema-habitus-sd.vercel.app` pueden convivir sin problema — Vercel permite varios dominios en un mismo proyecto, y se puede diferenciar qué mostrar en cada uno según el hostname de la request si hiciera falta.
8. **Diseño:** se conversó usar Figma (ya conectado) vs. ir directo a código — Ariel eligió ir directo a código entre los dos, mismo criterio que se usó para todo el resto del sistema hasta ahora.

**Pendiente real para arrancar:** ninguna decisión más de las básicas — cuando Ariel dé el ok, el primer paso es diseñar el modelo de datos del carrito/checkout público y el flujo de creación de venta desde afuera del sistema.

### Bloque 8 — Tablas base + Cult UI

`pedidos_web` creada (estado, medio elegido Mercado Pago/efectivo local, datos de contacto, `items` JSONB con precio/cantidad congelados, `venta_id` que se completa recién cuando la venta real se crea) — con RLS + GRANT para `authenticated`, **falta a propósito** la policy para `anon` hasta armar el checkout público de verdad. `articulo_imagenes` **ya existía** de una sesión sin documentar, pero sin RLS ni GRANT — mismo patrón de siempre con tablas preexistentes, corregido.

**Cult UI** (cult-ui.com, componentes animados sobre shadcn/Tailwind) sumado al proyecto a pedido de Ariel — confirmado que el proyecto ya estaba en Tailwind v4 (lo que pide Cult UI), sin migración necesaria. Se instaló `motion` y se configuró el registro en `components.json` (`"@cult-ui": "https://cult-ui.com/r/{name}.json"`) — el comando de instalación que traía la doc de Cult UI (`shadcn registry add`) no existe en la versión actual del CLI, la forma real es editar `components.json` a mano. Un 429 al correr `search @cult-ui` resultó ser un límite de tasa transitorio del lado de Cult UI, no un problema de configuración (confirmado bajando el registry.json directo). Se decidió usarlo solo para piezas vistosas de la vitrina (hero, carruseles) cuando aparezcan, no para la grilla simple del catálogo.

### Bloque 9 — Catálogo público (`/tienda`)

`src/proxy.ts` (el middleware de auth) ahora exceptúa `/tienda` además de `/login` — cualquier visitante externo puede verla sin cuenta.

Vista `articulos_catalogo_web` (no se expone la tabla `articulos` real al rol `anon` bajo ningún concepto — ahí vive `costo_sin_iva`): `nombre`, `nombre_base`, `descripcion`, `precio` (con `COALESCE(precio_oferta_web, precio_web, precio_local)`), `en_oferta`, rubro, marca, `sabor`, `stock` real de sucursal 1, y la imagen principal (o la primera disponible) vía `LEFT JOIN LATERAL` a `articulo_imagenes`. Tuvo que rehacerse una vez en el camino — el primer `CREATE VIEW` se corrió pero después se pisó sin querer con una versión vieja que no traía `nombre_base`/`sabor`, lo que rompía el agrupado silenciosamente (todo caía en grupos de a uno). Lección: verificar la vista real (`SELECT * FROM articulos_catalogo_web LIMIT 1`) después de cualquier cambio, no asumir que el último `CREATE` corrido es el que está activo.

`ProductoCard.tsx` (componente de cliente, único punto de interactividad de la pantalla): agrupa por `nombre_base + marca_id` cuando existe (los 5 rubros ya migrados al sistema de Sabores), muestra chips de sabor debajo del nombre, y al tocar uno cambia imagen/precio/stock/oferta sin recargar. Arranca mostrando el primer sabor con stock. Los rubros todavía sin migrar (`nombre_base` NULL) se siguen mostrando sueltos, sin romper nada.

**Bug real encontrado por Ariel y corregido:** el primer intento de "limpiar" `disponible_web` para Proteínas usó `stock_actual > 0` como condición — mezclaba dos cosas que deben ser independientes. `disponible_web` tiene que ser una decisión de negocio estable ("esto se vende por la web"), no algo atado al stock del momento — eso ya lo resuelve el badge "Sin stock" sin ocultar el producto. El criterio correcto es `disponible_local = true` (que ya distingue unidades sueltas reales de las presentaciones "Caja X Unidades"). Aplicado así para Proteínas (10 artículos → 4 productos agrupados); **pendiente aplicar el mismo criterio al resto del catálogo**.

**`precio_web`** de todo el catálogo activo confirmado igual a `precio_local` (Ariel: "los precio web cargados ahora no son reales") — no hizo falta ningún `UPDATE`, ya estaban iguales en la base; la diferencia que parecía verse en pantalla en un momento era por `precio_oferta_web` pisando el precio mostrado, no por `precio_web` en sí. Probado el circuito de oferta real: `precio_oferta_web` cargado en Frutilla de dos productos → aparece badge "OFERTA" y precio rebajado solo en ese chip, confirmado en pantalla.

### Bloque 10 — Fotos de producto

Bucket de Storage `articulo-imagenes` creado (público para lectura — lo tiene que poder ver cualquier visitante sin login —, restringido a `authenticated` para subir/editar/borrar). `ImagenesArticulo.tsx` (componente nuevo, en la solapa "Web y extras" de `ArticuloForm.tsx`, solo visible en artículos ya guardados — necesita el `articuloId`): subida múltiple, la primera foto sube como principal automático, después se puede cambiar cuál es la principal (pasando el mouse, ícono de estrella) o eliminar (borra de Storage y de la tabla juntos).

Probado en vivo con fotos reales de Whey Protein Doypack (Body Advance, 4 sabores) — confirmado que cada sabor muestra su propia foto real (no una genérica repetida) y que el estado "Sin stock" convive bien con la foto de esa variante puntual.

### Bloque 11 — Pantalla "Actualizar Fotos", fix de Marca scopeada, deploy que no disparaba, migración completa de Sabores, y arranque del carrito

**Pantalla nueva `articulos/fotos/page.tsx`** (mejora pedida por Ariel, mismo estilo que Actualizar Precios): filtros Buscar/Rubro/Marca/Disponibilidad/Stock + "Con o sin fotos" (en vez de "OC pendiente"). Grilla de miniaturas, cada una abre el mismo `ImagenesArticulo.tsx` en un modal. Checkboxes inline de **"Disponible en local"** y **"Visible en tienda"** por artículo (guardan solos al tocarlos) — para no ir a Editar Artículo uno por uno. Agregada al menú (`Sidebar.tsx`, dentro de `layout/`, no en la raíz de `components` — ojo con esto la próxima vez que se pida ese archivo).

**Bug real encontrado por Ariel, corregido en 2 pantallas:** tanto en Actualizar Fotos como en Actualizar Precios, el filtro de Marca mostraba **todas** las marcas del catálogo sin importar el Rubro elegido. Se corrigió calculando `marcasDisponibles` a partir de los artículos ya cargados y filtrados por rubro (no de la tabla `marcas` completa), con reseteo automático del filtro de marca si deja de tener sentido al cambiar de rubro.

**Incidente resuelto: el auto-deploy de Vercel dejó de dispararse.** Un push llegó bien a `origin/master` (confirmado con `git log`) pero no generó ningún deployment nuevo. Se resolvió forzando un deploy vacío (`git commit --allow-empty`) — **queda pendiente investigar la causa real** (posible corte en la integración GitHub↔Vercel) en una sesión futura, no se llegó a diagnosticar a fondo.

**Migración completa de Sabores, rubro por rubro** (recorrido alfabético a pedido de Ariel, con SQL de por medio, no vía UI): Aminoácidos, Colágenos, Energía, Foods, Salud y bienestar quedaron agrupados con `nombre_base`/`sabor_id`, creando algunos sabores nuevos en el camino (Fruit Punch, Strawberry-Lemon, Açaí, Blueberry-Raspberry, Frambuesa — reutilizados varias veces entre rubros). Confirmado sin cambios necesarios en Glutamina, Multivitamínicos, Óxido Nítrico, Pro Hormonal, Quemadores, Sales (sin variantes de sabor real). **Shakers descartado a propósito** — ahí la variante es color, no sabor, y forzarlo en `sabor_id` ensuciaría el catálogo de sabores para siempre; ya se distingue bien solo con las fotos. Confirmado que Creatinas, Bebidas Isotónicas, Pre-entrenamiento, Proteínas, Proteínas Vegetales ya estaban migrados de sesiones anteriores.

**Bug de fondo encontrado en la migración, afectó a 80 artículos:** el trigger `fn_generar_nombre_articulo` arma `articulos.nombre` a partir de `nombre_base + atributo_valor + marca` — **no** de `sabor_id`. Como las migraciones de hoy solo cargaban `nombre_base`+`sabor_id` (correcto para que la vitrina agrupe), el trigger reescribió el nombre real de cada artículo sin el sabor adentro (ej. las 4 variantes de "Mtor Bcaa" quedaron con el mismo nombre "Mtor Bcaa - 270 G - Star Nutrition", sin distinguir sabor). No se notaba en `/tienda` porque ahí el título sale de `nombre_base`, no de `nombre` — recién se destapó al mirar la pantalla nueva de Actualizar Fotos, donde sí se ve el `nombre` real. **Corregido con un solo `UPDATE`** completando `atributo_valor = sabores.nombre` para los 80 casos — el mismo trigger reconstruyó bien el nombre solo. Lección para toda futura migración de sabores: cargar `nombre_base` + `sabor_id` **y también `atributo_valor`** juntos, no solo los dos primeros.

**Migración de `Barras de proteína` y `Geles`/`Geles Cafeína`** (rubros que estaban con `disponible_web=false` a propósito): ya tenían `nombre_base`/`sabor_id` cargados de antes (no hizo falta agruparlos), solo se prendió `disponible_web` — con la salvedad de excluir las presentaciones "Caja X Unidades" (`nombre_base NOT ILIKE '%Caja%'`), porque esas no se venden sueltas y Ariel quiere agregarles más adelante un **mínimo de compra de 10 unidades por `nombre_base`** (mezclando sabores). Confirmado que "Geles Cafeína" como rubro separado ya no tiene artículos activos — todo se unificó bajo "Geles" con "Cafeína" en el nombre.

**Arranque del carrito de la Vitrina** (primera versión funcional):
- `CarritoContext.tsx` — Context de React, persistido en `localStorage` (no hay login en la vitrina pública, no hay otra forma de guardar estado entre visitas).
- `src/lib/tienda/config.ts` — `MINIMOS_POR_RUBRO`, hoy `{ 'Barras de proteína': 10, 'Geles': 10 }` — fácil de ampliar.
- `ProductoCard.tsx` ampliado: selector de cantidad (respeta el stock de la variante elegida) + botón "Agregar", con feedback visual de "Agregado" por 1,5 segundos.
- `CarritoBoton.tsx` — ícono con contador en el header de `/tienda`.
- `/tienda/carrito/page.tsx` — pantalla nueva: editar cantidades, sacar ítems, aviso ámbar si algún `nombre_base` de un rubro con mínimo no llega al mínimo (bloquea el botón "Continuar"), total. El botón "Continuar" todavía no lleva a ningún lado — el checkout real (Mercado Pago / retiro y pago en efectivo) queda para la próxima sesión.

### Bloque 12 — Checkout de Mercado Pago: cierre y cadena de 5 bugs

Se completaron los dos caminos de compra de la Vitrina, conversados en el Bloque 7:

1. **Pago online vía Mercado Pago:** Preference creada al confirmar el carrito en `/tienda`, webhook que recibe la notificación de pago y crea la venta real en Habitus SD (con su fiscalización correspondiente).
2. **Retiro + pago en el local:** pantalla nueva **"Pedidos Web"** (`/pedidos-web`) donde se gestionan los pedidos que eligieron este camino. Botón "Cobrar en caja" crea un registro en `ventas_borrador` con `pedido_web_id` asociado y redirige directo a `/ventas?borrador=X`, reutilizando el mecanismo de borradores del Bloque 3 en vez de duplicar lógica.

**Cadena de bugs encontrados y corregidos, en el orden real en que aparecieron** (vale la pena dejarla completa porque cada uno tapaba al siguiente — sin el primero no se veía el segundo, y así):

1. **`src/proxy.ts` sin `/api/tienda` en rutas públicas.** Next.js 16 renombró la convención de `middleware.ts` a `proxy.ts` — las rutas públicas de la API para el checkout y el webhook estaban bloqueadas para visitantes sin sesión porque no estaban en la lista de excepciones (la misma que ya exceptuaba `/tienda` y `/login`, ver Bloque 9).
2. **GRANTs de `service_role` faltantes.** Postgres separa permisos de tabla y de secuencia — faltaban GRANTs sobre varias tablas nuevas del circuito **y** sobre `ALL SEQUENCES`/`ALL TABLES` en el schema `public` para el rol `service_role`. Mismo patrón de siempre con RLS + GRANTs independientes (ver lección de la sección de aprendizajes), pero esta vez además con la capa de secuencias.
3. **Falta de suscripción de Webhooks en el panel de Mercado Pago.** El `notification_url` de cada Preference no alcanza — Mercado Pago requiere una suscripción de Webhooks configurada aparte, en el panel Developers → la app → Webhooks (modo productivo), apuntando a la URL de producción. Sin esto, MP nunca llamaba al webhook aunque el código estuviera perfecto — el bug más difícil de detectar de toda la cadena porque no había ningún error visible del lado del sistema.
4. **Condición de carrera por notificaciones duplicadas.** Mercado Pago reenvía notificaciones del mismo pago más de una vez; el webhook, tal cual estaba, creaba una venta por cada notificación. Se corrigió con un `UPDATE` atómico que "reclama" el pedido (`WHERE estado='pendiente_pago'` al pasar a `'procesando_pago'`) en vez de un `SELECT` seguido de `UPDATE` — mismo patrón que ya se usa en otras partes del sistema para prevenir duplicados (ver lección de aprendizajes).
5. **`fiscalizarVenta()` bloqueada por RLS en el webhook.** La función armaba su propio cliente de Supabase atado a la sesión del usuario logueado — en el caso del webhook (sin ningún usuario logueado, es Mercado Pago llamando al servidor) quedaba bloqueada por RLS en silencio, sin lanzar un error claro. Se agregó un parámetro opcional para pasarle el cliente admin (`service_role`) cuando se invoca desde un contexto sin sesión, manteniendo el comportamiento normal para el flujo de POS con usuario logueado.

**Verificación real:** compra de punta a punta confirmada en producción — pago → pedido confirmado → venta creada → stock descontado → fiscalización, sin intervención manual en ningún paso. Los pedidos **#1496** y **#1497**, que habían quedado en estado "Rechazada/Error" en la pantalla de Fiscalización por el bug #5 (antes de corregirlo), ya se reintentaron desde ahí y fiscalizaron correctamente.

### Bloque 13 — Frente paralelo: diseño de la Vitrina con Claude Code + Impeccable

Trabajo de diseño visual puro de `/tienda`, hecho en **Claude Code** (CLI corriendo en la carpeta del proyecto), no en este chat — Claude Code no tiene memoria de esta conversación, así que cualquier cambio de diseño hecho ahí se documenta acá para no perderlo.

Se instaló el plugin **Impeccable** (`pbakaus/impeccable`). Con `/impeccable init` y `/impeccable document` se generaron `PRODUCT.md` y `DESIGN.md`, ya revisados y alineados con el sistema real: paleta `#00a19a`/`#3c3c3b`/`#ededed`, filosofía **"The Efficient Workshop"** (utilitario, sin adornos, sin sombras decorativas), tipografía única Inter 14px, radios de 10px, bordes 1px.

### Bloque 14 — Impeccable audit de `/tienda`: de 11/20 a 20/20

Primer `/impeccable audit tienda` (sobre `src/app/tienda/page.tsx`) dio **11/20** ("Acceptable — significant work needed"). Hallazgos reales, no ruido: colores hardcodeados en vez de tokens de diseño (15+ instancias), badges/selector de sabor en 10-11px contra la "Single-Size Rule" de 14px de `DESIGN.md`, falta de `aria-label` en los controles de cantidad (bloqueante P0 de accesibilidad), jerarquía de headings incompleta, buscador sin `<label>` explícito, y touch targets por debajo del mínimo recomendado para mobile.

**Decisión sobre los badges (criterio: legibilidad en mobile por sobre consistencia estricta con el DESIGN.md original):** subir de 10-11px a 12px mínimo, no documentar la excepción.

**Falso positivo detectado y descartado:** el audit marcó como faltante el botón "Continuar al pago" en `carrito/page.tsx`. Se verificó código en mano antes de tocar nada — el botón existe y funciona (línea 115-130, con estado deshabilitado + tooltip cuando falta el mínimo de compra, y `<Link>` a `/tienda/checkout` cuando está todo ok). El audit truncó su lectura del archivo antes de llegar a esas líneas; no era un problema real.

**Fixes aplicados, en orden:**
1. **P0 accesibilidad:** `aria-label` en los botones de cantidad ("Disminuir cantidad"/"Aumentar cantidad") + `role="status" aria-live="polite"` para anunciar el valor a lectores de pantalla.
2. **P1 tokens:** todos los colores hardcodeados (`#00a19a`, `#3c3c3b`, `#ededed`, clases `gray-*`) migrados a tokens semánticos nuevos en `globals.css` (`--charcoal`, `--offer-teal`, `--medium-gray`, `--border-gray`, `--surface-subtle`, `--surface-light`) y sus clases correspondientes (`bg-offer-teal`, `text-charcoal`, etc.) en `ProductoCard.tsx`, `CarritoBoton.tsx`, `carrito/page.tsx` y `OrdenTienda`.
3. **P1 tipografía:** `text-[10px]`/`text-[11px]` → `text-xs` (12px) en badges y selector de sabor.
4. **P1 semántica/accesibilidad:** `<h2 className="sr-only">` sobre la grilla de resultados, secciones de filtro envueltas en headings con `aria-expanded`, `<label htmlFor="tienda-search" className="sr-only">` en el buscador, selector de sabor envuelto en `role="radiogroup"` con `role="radio"`/`aria-checked` por botón + indicador visual (`ring-2 ring-offer-teal`, no solo color) + texto oculto "(seleccionado)" para lectores de pantalla, y skip link (`sr-only focus:not-sr-only`) al landmark `#productos`.
5. **P2 mobile:** touch targets ampliados a 44px mínimo — botones de cantidad con `min-w-[44px] min-h-[44px]` (tamaño visual sin cambiar, área de toque sí), píldoras de sabor con pseudo-elemento `before` y margen negativo para ampliar el área sin cambiar el tamaño visual.
6. **P2 performance:** `loading="lazy"` en todas las imágenes de producto.

Los P3 (transiciones de estado, `prefers-reduced-motion`, refactor del formateo de precio a un helper compartido) quedaron **fuera de scope a propósito** — sin impacto real en accesibilidad ni en mobile, se retoman si hay tiempo más adelante.

**Re-audit confirmó:** score final **20/20 ("Excellent")**, todos los P0/P1 resueltos, botón "Continuar" reconfirmado funcional, **sin hallazgos nuevos** — en particular, sin desvíos de la filosofía "The Efficient Workshop" (nada de sombras decorativas ni radios fuera de 10px se coló al migrar a tokens).

### Bloque 15 — Verificación en celular real: bug de layout + regresión seria de touch (y su fix)

Después del re-audit 20/20 del Bloque 14, en vez de darlo por cerrado se probó a mano en un celular real (además del emulador de Chrome) — decisión que resultó clave, porque destapó dos problemas que el audit automatizado nunca iba a detectar (mide estructura de código y accesibilidad estática, no comportamiento real en interacción táctil).

**Bug 1 — Botón "Agregar" cortado.** Visible tanto en desktop como en mobile, en todas las cards: el texto quedaba truncado a solo el ícono del carrito + una letra suelta. Causa: el `min-w-[44px]` agregado a los botones de cantidad (fix de touch targets del Bloque 14) empujaba el ancho combinado de la fila (selector de cantidad + botón Agregar) más allá del espacio disponible en la card, en cualquier breakpoint.

**Fix aplicado en `ProductoCard.tsx` y `carrito/page.tsx`:**
- `flex-wrap` en el contenedor de esa fila — el botón "Agregar" puede bajar a una fila propia si no entra.
- Botones de cantidad: `w-9 h-9` (36px visual) en vez de `min-w-[44px]` fijo, con `shrink-0` para que no se compriman.
- Botón "Agregar": `min-w-[100px]` para garantizar espacio al texto completo.
- **Touch target mantenido en 44px real** (no se resignó a bajar a solo AA): pseudo-elemento `before:absolute before:inset-0 before:-m-1` que amplía el área de toque sin cambiar el tamaño visual de 36px — mismo mecanismo ya usado en las píldoras de sabor.

**Bug 2 — Regresión seria: el touch dejó de funcionar (más grave que el anterior).** Confirmado en celular real, no en emulador: el selector de sabor mostraba el aro verde de selección moviéndose, pero **no cambiaba imagen/precio/stock real** — como si solo se actualizara el `aria-checked` sin disparar la acción real. Mismo síntoma en los headers colapsables de "Categorías"/"Marca" (no desplegaban al tocar) y en el checkbox "Solo con stock" (quedaba marcado pero no filtraba). Todo esto funcionaba bien en desktop con mouse — el bug era específico de touch.

**Causa raíz, confirmada:** los pseudo-elementos `before:absolute` agregados para ampliar áreas de toque (sabor, cantidad) y el ícono `<ChevronDown>` dentro de los headers colapsables estaban **interceptando el evento táctil sin propagarlo** al elemento padre que tenía el `onClick` real — un problema clásico de elementos superpuestos con `position: absolute` en dispositivos táctiles, que el mouse en desktop tolera mejor que el motor de touch de un celular.

**Fix:** agregar `pointer-events-none` a los pseudo-elementos y al ícono `ChevronDown`, para que sigan ampliando visualmente el área pero dejen pasar el evento al elemento real debajo.
```
/* Antes (bloqueaba touch) */
before:content-[''] before:absolute before:inset-0 before:-m-1

/* Después (touch funciona, área visual expandida a 44px) */
before:content-[''] before:absolute before:inset-0 before:-m-1 before:pointer-events-none
```
Aplicado en `ProductoCard.tsx` (píldoras de sabor y botones de cantidad), `carrito/page.tsx` (botones de cantidad) y `FiltrosTienda.tsx` (ícono `ChevronDown` en los headers de Categorías/Marca).

**Camino de verificación, con un tropiezo instructivo en el medio:** la primera prueba después del fix se hizo contra el servidor de desarrollo local (`next dev`), accedido desde el celular por la IP de la red LAN (`http://192.168.x.x:3000`) — y **seguía fallando todo**, incluso peor que antes (ni el checkbox "Solo con stock" filtraba). En vez de seguir parchando a ciegas, se probó la hipótesis de que el propio dev server (overlay de Fast Refresh / WebSocket de hot-reload) estuviera interfiriendo con eventos táctiles al accederlo por LAN — algo que no pasa con `localhost` puro ni en un build real. Se armó una rama (`fix/impeccable-touch`), se pusheó, y se probó contra el **Preview Deployment** que generó Vercel automáticamente: ahí los 4 puntos (sabor, cantidad, categorías/marca, stock) funcionaron perfecto en el celular. Confirmada la hipótesis: el código estaba bien, el problema era artefacto del dev server accedido por LAN. Se mergeó `fix/impeccable-touch` a `master` (fast-forward, commit `1ddcac1`) y se **reconfirmó en producción real** desde el celular, sin bugs.

**Lección para futuras rondas de accesibilidad:** el truco de pseudo-elemento para ampliar áreas de toque (`before:absolute before:inset-0` con margen negativo) **siempre necesita `pointer-events-none`** — si no, en touch devices puede robar el evento al elemento real sin que se note en pruebas de desktop con mouse. Y para verificar comportamiento táctil real, el dev server accedido por IP de LAN no es confiable — usar un Preview Deployment de Vercel (o el build de producción) da resultados representativos de verdad.

**Efecto colateral resuelto:** el archivo `src/app/test-cards/page.tsx` (mock creado por Claude Code para verificar el layout cuando no tenía acceso a Supabase en un momento intermedio) se eliminó al cierre — nunca llegó a estar commiteado en git, así que no hubo riesgo de exposición pública real.

**Falso positivo descartado:** en el camino de las pruebas parecía que algunos artículos puntuales se mostraban sin selector de cantidad ni botón "Agregar" sin explicación ("Caffeine - 60 Cápsulas - 60 Servicios - Ena", una Creatina Monohidrato a $38.000). Verificado con una captura completa: **sí tenían el badge "SIN STOCK"** correctamente — el recorte de una captura anterior lo había dejado fuera de cuadro, lo que generó la falsa alarma. Comportamiento correcto, sin nada que corregir.


### Bloque 16 — Mínimo de compra por rubro (cambio de regla, frontend + servidor) y patrón de fiscalización con reintento

**Cambio de regla de negocio:** el mínimo de compra de "Barras de proteína" y "Geles" (`MINIMOS_POR_RUBRO`, `src/lib/tienda/config.ts`) pasó de calcularse por `nombre_base` a calcularse por **rubro completo**. Antes, 10 unidades de "Ironbar Energy Protein" cumplían el mínimo (repartidas entre sus sabores), pero mezclar productos distintos del mismo rubro no sumaba entre sí. Ahora cualquier combinación de productos y sabores dentro de un mismo rubro cuenta junta para el total de 10 — cada rubro mantiene su propio mínimo, no se mezclan entre sí (8 de Barras + 2 de Geles no cumple ninguno de los dos). Cambiado el cálculo en `carrito/page.tsx` (`totalesPorRubro` en vez de `totalesPorNombreBase`) y el mensaje del aviso ámbar, que ahora referencia el rubro en vez de un producto puntual. **Probado en local con mouse** (no hacía falta el celular para esto, el bug de touch del Bloque 15 era específico de LAN): 3 productos distintos de "Barras de proteína" sumando 7 unidades → bloqueado correctamente; sumando 10 → botón habilitado. Confirmado que "Geles" no se mezcla con "Barras".

**Validación server-side agregada** en `src/app/api/tienda/checkout/route.ts` (endpoint único que maneja ambos caminos, `mercado_pago` y `retiro_efectivo`). El endpoint ya resolvía correctamente el rubro real de cada artículo consultando la base (nunca confía en lo que manda el cliente) — pero la validación de mínimos tenía el mismo bug que había tenido el frontend antes del fix: agrupaba por `rubro::nombre_base` en vez de por rubro completo. Corregido para agrupar solo por `rubro_nombre`, igual que el frontend. La validación ocurre antes del `INSERT` del `pedido_web`, en ambos caminos — si no se cumple el mínimo, devuelve `400` con el mismo mensaje que ve el usuario en el carrito ("Barras de proteína: tenés X unidades, el mínimo es 10 — faltan Y."), sin crear ningún registro. De paso se corrigió el status code de ese caso puntual de `409` a `400` (semánticamente correcto para un error de validación de reglas de negocio; se confirmó que nada en el frontend depende del código específico, solo del campo `error` del JSON — el `409` original en otro punto del mismo endpoint, para conflictos de stock/disponibilidad, se dejó sin tocar).

**Nota sobre el nivel de verificación:** no se pudo ejecutar una prueba directa contra el endpoint (`curl`) porque el entorno de desarrollo local no tenía cargada `SUPABASE_SERVICE_ROLE_KEY` — se decidió no exponer esa credencial en local para una prueba puntual de bajo riesgo. En su lugar se confirmó (a) por lectura de código que la validación está bien ubicada y agrupa correctamente, y (b) en la práctica, que el frontend bloquea correctamente el intento de avanzar con un carrito por debajo del mínimo. Se aceptó ese nivel de confianza para esta regla porque el peor escenario posible (alguien comprando menos de 10 unidades de un rubro puntual) es una regla comercial menor, no una vulnerabilidad de seguridad ni un riesgo de datos/dinero — no ameritaba el esfuerzo/riesgo de exponer la credencial de servicio para cerrarlo del todo.

**Mejora de UX en el checkout:** se agregó un texto de ayuda debajo de "Nombre y apellido" en `/tienda/checkout` aclarando que es el nombre de quien retira el pedido, y que se pide DNI al momento de la entrega — resuelve de forma simple (sin fricción técnica) la duda de qué tan confiable es el dato de contacto que carga el cliente, reforzado con un control humano real en el mostrador en vez de validaciones de formulario.

**Patrón confirmado en Fiscalización — no es un bug nuevo:** la venta #1498 (pedido web #9, primera compra real después del cierre del Bloque 15) quedó "Rechazada/Error" en el primer intento automático, igual que había pasado antes con #1496 y #1497 (Bloque 12). El botón "Reintentar" de la pantalla Fiscalización la resolvió sin problema, mismo patrón que los casos anteriores. **Con tres casos ya confirmados con el mismo comportamiento**, queda anotado como algo a vigilar — si se vuelve más frecuente, vale la pena investigar la causa de fondo (posible timing/timeout puntual con TusFacturasAPP en el primer intento), pero por ahora el circuito de reintento manual absorbe el problema sin bloquear ninguna venta.


**Ordenamiento del catálogo — con stock primero:** en `/tienda`, el listado ordenaba por el criterio del dropdown "Ordenar por" (nombre por defecto) sin distinguir stock, lo que hacía que productos "SIN STOCK" aparecieran mezclados arriba de la grilla — mala primera impresión para un cliente nuevo. Cambiado a un orden de dos niveles: primer nivel fijo (con stock siempre primero, sin stock al final), segundo nivel el criterio que ya elige el usuario en el dropdown (nombre, precio ascendente/descendente). El checkbox "Solo con stock" sigue funcionando igual, sin cambios — este ajuste es solo de orden visual por defecto. Confirmado en local.

### Bloque 17 — Lanzamiento del dominio propio: `habitussd.com` apuntado a producción

**Objetivo cumplido:** `habitussd.com` (y `www.habitussd.com`) dejaron de apuntar a Empretienda y ahora apuntan al sistema propio en Vercel. El corte se hizo en el mismo día, sin bloquearse en la dependencia de terceros.

**Camino recorrido, con un obstáculo real en el medio:**
1. Se agregó `habitussd.com` como dominio del proyecto en Vercel (Settings → Domains → "Add Existing"), que entregó los registros DNS objetivo: `A @ → 216.198.79.1` y `CNAME www → 3daab47f5db18da5.vercel-dns-017.com`.
2. **Obstáculo:** el DNS de `habitussd.com` no se administraba en GoDaddy (que solo era el registrador) sino en la infraestructura propia de **Empretienda** (nameservers `ns1-4.empretienda.net`), con los dos registros A del dominio bloqueados para edición manual — solo editables por Empretienda mismo, vía ticket de soporte con demora de hasta 24hs hábiles.
3. **Se evitó la demora:** como Ariel no usa las casillas de correo `@habitussd.com` (usa Gmail propio), no había riesgo real en cortar por completo la zona DNS de Empretienda. Se cambiaron los **nameservers del dominio de vuelta a los predeterminados de GoDaddy** (`ns07/ns08.domaincontrol.com`) desde el panel de GoDaddy → Dominio → DNS → Servidores de nombres — esto le devolvió a Ariel el control total del DNS sin depender de que Empretienda respondiera el ticket. Propagación confirmada en minutos, no horas.
4. Con el DNS ya en GoDaddy, se editaron los dos registros (A y CNAME) con los valores de Vercel. Propagación también rápida — confirmado por Vercel pasando de "Invalid Configuration" a "Valid Configuration" en los tres dominios (`habitussd.com`, `www.habitussd.com`, y el `.vercel.app` original).

**Nota para el futuro:** como el dominio ahora vive en los nameservers de GoDaddy y no en los de Empretienda, la tienda de Empretienda quedó con su dominio propio desconectado — si en algún momento hace falta reactivarla como respaldo, habría que reconfigurar el dominio ahí de nuevo (no es automático).

**Verificado en producción real** con el circuito completo: catálogo cargando con fotos en `habitussd.com/tienda`, carrito, checkout con el texto de ayuda del Bloque 16 visible. La compra real de punta a punta con Mercado Pago quedó pendiente de una prueba de un tercero (no bloqueante — el resto del circuito ya está confirmado funcionando en el dominio nuevo desde sesiones anteriores).

**Efecto colateral encontrado y corregido — dos bugs en cadena:**
1. Como `habitussd.com` apunta a todo el proyecto de Vercel (no solo a `/tienda`), la raíz del dominio caía en el login del sistema interno — mala exposición de cara al público. Corregido en `src/app/page.tsx`: la raíz `/` ahora redirige a `/tienda` en vez de `/dashboard`. Confirmado que `proxy.ts` sigue protegiendo `/dashboard` y el resto de rutas internas igual que siempre — este cambio solo mueve el destino del redirect público, no saca ninguna protección.
2. Ese cambio rompió a su vez el flujo de login: `src/app/login/page.tsx` redirigía a `/` después de un ingreso exitoso, confiando en que `page.tsx` lo mandaría a `/dashboard` — al cambiar ese destino a `/tienda`, cualquiera que iniciara sesión (Ariel, Agustín) terminaba en la vitrina en vez del sistema. Corregido haciendo el redirect explícito en el login mismo (`router.push('/dashboard')` en vez de `router.push('/')`), sin depender del comportamiento de la raíz.

**Los 4 casos verificados en producción real, funcionando:**
- `habitussd.com` (sin sesión) → vitrina ✓
- `habitussd.com/tienda` (sin sesión) → vitrina ✓
- Login desde `sistema-habitus-sd.vercel.app/login` → `/dashboard` ✓
- Login desde `www.habitussd.com/login` → `/dashboard` ✓

### Bloque 18 — Favicon de marca y sincronización precio local/web

**Favicon:** las pestañas del navegador mostraban el ícono genérico negro de Vercel en vez de la identidad de Habitus. Se extrajo el símbolo "H" (imagotipo, gradiente Persian Green) directo del `HABITUS_BRANDGUIDE_2025.pdf`, se recortó con fondo transparente y se generaron los archivos estándar de Next.js 16 App Router (`icon.png` 512px, `apple-icon.png` 180px, `favicon.ico` multi-resolución 16/32/48px) — colocados directo en `src/app/`, sin necesidad de tocar `layout.tsx` ni código. Confirmado funcionando en las pestañas del navegador tras el deploy.

**Sincronización `precio_local` / `precio_web`:** se detectó que la Vitrina mostraba precios desactualizados en varios productos de Geles (Nutremax) — el sistema de admin ya tenía actualizado `precio_local`, pero `precio_web` es un campo separado que no se actualizaba solo. Alcance real, confirmado por consulta antes de tocar nada: **solo 6 artículos afectados** (ids 1129-1131 y 1089-1091, todos Geles, todos con $200 de diferencia — sin NULLs ni casos raros). Regla de negocio definida: por defecto ambos precios van sincronizados; si se edita `precio_web` puntualmente en la pantalla de Actualizar Precios, ese artículo queda "fijado" en ese valor (deja de sincronizarse automático) hasta que se vuelva a igualar a mano. Implementado en `articulos/precios/page.tsx`: columna nueva "Precio web" editable, flag `precioWebEditadoManualmente` por artículo con indicador visual (borde/color) de si está sincronizado o fijado a mano, `guardarPrecio()` actualiza ambos campos y registra ambos valores en `historico_precios`. Corrección única de los 6 artículos desfasados ejecutada por Ariel directamente en el SQL Editor de producción. Probado en local (sincronización automática y fijación manual funcionando) y confirmado en producción con los precios de Geles ya coincidiendo entre sistema y `habitussd.com/tienda`.

**Nota de proceso:** a partir de esta sesión, las consultas SQL de **solo lectura** (SELECT, conteos, verificaciones) las corre Ariel directamente en el SQL Editor de producción en lugar de pedírselas a Claude Code — evita vueltas innecesarias (incluida una página temporal de verificación que se armó y se descartó en el camino, por no tener Claude Code la `SERVICE_ROLE_KEY` en el entorno local). Los cambios reales de datos (UPDATE/INSERT/DELETE) se siguen revisando y aprobando antes de ejecutar, como siempre.

### Bloque 19 — Primera factura real pedida por un cliente + botón de descarga de PDF

**Primer caso real de un cliente pidiendo la factura de una compra** (Factura C PV 0004 #00000081, $110.000, CAE `86327787685432` confirmado) — hasta ahora se resolvió descargándola manualmente desde el panel de TusFacturasAPP (`tusfacturas.app/app/misventas.html`), lo cual funciona pero implica salir del sistema propio.

**Se agregó un botón "Descargar PDF"** en Registro de Ventas y en Fiscalización, visible solo en ventas con `estado_fiscal_id = 3` (CAE confirmado), para bajar el comprobante sin ir al panel externo — pensado para uso ocasional (~4 veces al mes), por lo que se descartó automatizar el envío por mail/WhatsApp (no vale la pena la complejidad/costo de una integración de envío para ese volumen).

**Funcionamiento:** el PDF **no lo genera ni lo diseña el sistema propio** — el botón llama al endpoint de regeneración de TusFacturasAPP (`POST /facturacion/regenerar_pdf`) al momento del clic y abre la URL que devuelven (temporal, válida solo el día de la consulta) en una pestaña nueva. Nuevo endpoint: `src/app/api/comprobantes/regenerar-pdf/route.ts`. Confirmado que estas llamadas cuentan como requests contra el plan de TusFacturasAPP (no contra el límite de 1000 comprobantes/mes) — con 4 usos mensuales, impacto insignificante.

**Bug encontrado y corregido en el camino:** la primera versión armaba el número de punto de venta y tipo de comprobante consultando las tablas relacionadas `puntos_venta`/`tipos_comprobante`, lo que generaba un formato distinto al que espera la API de TusFacturasAPP ("Las credenciales API son inválidas" — mensaje engañoso, la causa real no eran las credenciales sino el formato de esos dos campos). Corregido usando las mismas constantes hardcodeadas que ya usa `mapeo.ts` para la fiscalización normal (`PUNTO_VENTA = '0004'`, `'FACTURA C'`), en vez de reconstruirlas desde la base.

**Verificación:** no se pudo probar en local (mismo límite ya conocido: `SUPABASE_SERVICE_ROLE_KEY` y credenciales de TusFacturasAPP solo disponibles en el entorno de Vercel) — se decidió saltar directo a producción real dado el riesgo bajo del cambio (solo lee un PDF ya existente, no crea ni modifica ningún comprobante). **Confirmado funcionando en producción**, descarga correcta de la factura real del cliente de hoy.

**Nota para el futuro — logo en la factura:** el diseño del PDF (hoy con los datos personales de Ariel en el encabezado, sin logo de Habitus) es el layout estándar de TusFacturasAPP, no algo generado por el sistema propio. Si se quiere personalizar con el logo de Habitus, la configuración vive del lado del panel de TusFacturasAPP (sección de personalización/marca de la cuenta), no en el código — pendiente sin explorar todavía.


1. Confirmar una compra real de punta a punta con Mercado Pago en `habitussd.com/tienda` (pendiente de que un tercero la complete) — resto del circuito ya verificado.
2. Seguir subiendo fotos por categoría (trabajo manual de Ariel) — Aminoácidos, Colágenos, Energía, Foods, Salud y bienestar todavía no tienen fotos.
3. Investigar la causa real de por qué se cortó el auto-deploy de Vercel (Bloque 11) — no se llegó a diagnosticar, solo se resolvió con un deploy forzado.
4. Retomar las descripciones de Empretienda cuando la vitrina esté más avanzada (Excel ya armado, ver Bloque 6).
5. Mercado Pago POS (terminal física para pagos con tarjeta en el local) — auto-completar emisor + nro. de operación vía webhook (MVP v2, no confundir con el webhook de la Vitrina ya resuelto en el Bloque 12).
6. Ítems P3 del audit de Impeccable, si hay tiempo (transiciones de estado, `prefers-reduced-motion`, formateo de precio centralizado en un helper).

## 26. Sesión 12/08/2026 — Pedidos Web completo, fixes de ordenamiento, ARCA/plan de pago, investigación de stock

### Bloque 1 — Botón de WhatsApp en Pedidos Web

Primera de las 5 mejoras identificadas la sesión pasada comparando contra Empretienda (ver sección 25 y `ESTADO-PROYECTO.md` previo). Agregado en `pedidos-web/page.tsx`: link directo a `wa.me/<numero>` junto al teléfono del cliente, con función `linkWhatsApp()` que limpia el número y antepone el prefijo `549` (Argentina, celular) si no lo tiene. Probado con "Pagar y retirar en el local" (sin llegar a confirmar el cobro, para no generar stock/movimientos reales) — confirmado que abre WhatsApp con el número correcto. Ajustado a pedido de Ariel de un botón pill visible (fondo/borde verde) en vez de un ícono solo, que quedaba muy chico.

### Bloque 2 — Bug real: "1× null" en pedidos con artículos sin variante de sabor

Al probar el botón de WhatsApp con Beta Alanina (Star Nutrition, artículo sin sabor), la fila del pedido mostraba "1× null" en vez del nombre. Causa: `api/tienda/checkout/route.ts` arma el `items` (JSONB) de `pedidos_web` usando siempre `art.nombre_base` sin fallback — y `nombre_base` es NULL para cualquier artículo **sin variante de sabor** (no solo para rubros sin migrar), ya que nunca hubo necesidad de agruparlo. Afecta a cualquier producto de un solo SKU en cualquier rubro, migrado o no.

**Fix en el checkout:** SELECT de artículos ahora trae también `nombre` (columna real, siempre presente), y se usa `art.nombre_base ?? art.nombre` en los tres lugares que lo necesitaban (mensajes de error de stock/disponibilidad, línea del pedido, título que ve Mercado Pago en el Preference). Cubre cualquier caso futuro sin volver a romper.

**Backfill de datos históricos:** se encontraron 55 artículos activos (`disponible_web=true`) sin `nombre_base` cargado, todos productos de un solo sabor en rubros ya migrados (Aminoácidos, Colágenos, Energía, Glutamina, Multivitamínicos, Óxido Nítrico, Pro Hormonal, Quemadores, Sales, Salud y bienestar, Shakers). Se les cargó `nombre_base` con el mismo criterio que el resto del catálogo (nombre sin marca al final) — 7 casos especiales (ids 887, 888, 897, 1169, 1290, 1291, 1292) no tenían la marca en el `nombre` original; se decidió agregarla (ej. "Bcaa 2:1:1 - 90 Cápsulas") para que el trigger `fn_generar_nombre_articulo` la sume de forma consistente, aunque el nombre visible cambió levemente para esos 7. Verificado con muestra que el trigger reconstruyó bien el `nombre` en todos los casos.

### Bloque 3 — Campo "Observaciones" en el checkout de la Vitrina

Columna nueva `pedidos_web.observaciones` (text, nullable). Agregado textarea opcional en `tienda/checkout/page.tsx` (máx 300 caracteres, con nota de qué usarla — horario de retiro, preferencias), guardado en `api/tienda/checkout/route.ts` (sanitizado y truncado server-side también), y mostrado en `pedidos-web/page.tsx` con fondo destacado cuando el pedido tiene contenido.

### Bloque 4 — Estado de facturación + descarga de PDF en Pedidos Web

Reutiliza el mismo endpoint ya existente del Bloque 19 (`api/comprobantes/regenerar-pdf`) — sin duplicar lógica. Se agregó consulta a `comprobantes` por `venta_id` (misma query separada + Map, patrón del proyecto) y un chip "Fiscalizada" (verde) / "Sin fiscalizar" (gris) junto con el botón "PDF" cuando `estado_fiscal_id = 3`. Terminología unificada con Registro de Ventas ("Fiscalizada", no "Facturada") a pedido de Ariel tras comparar ambas pantallas lado a lado.

### Bloque 5 — Rediseño completo de Pedidos Web a formato tabla expandible

A pedido de Ariel, tras ver que toda la info amontonada a la izquierda quedaba difícil de leer: se rehízo `pedidos-web/page.tsx` siguiendo el mismo patrón visual que `ventas/registro/page.tsx` — fila resumen en columnas fijas con clic para expandir (chevron), detalle abajo con tabla de ítems, WhatsApp, Observaciones, y el bloque de facturación.

**Separación explícita de dos conceptos que antes estaban mezclados en un solo chip:** columna **Estado** (estado del pago: Esperando pago / A cobrar / Pagado / Rechazado / Sin stock) y columna **Entrega** (Retirado + fecha / Sin retirar) — son dos campos independientes en la base (`estado` vs `entregado_en`) y ahora se ven independientes en pantalla también.

El bloque Fiscalizada/Total/PDF se agrupó y alineó igual que en Ventas (columna Medio con `flex-1` empuja todo el resto al borde derecho, mismo mecanismo que la columna Medios en Registro de Ventas) — llevó dos iteraciones de ajuste visual hasta calzar exactamente igual.

**Pendiente de la lista original de mejoras:** punto 5 (menú de acciones más completo — cancelar orden, revertir pago manualmente) sigue sin construir, es el más delicado porque toca stock y estado fiscal a la vez.

### Bloque 6 — Fixes menores de ordenamiento (3 pantallas)

- **Historial de Artículos:** el combo de Rubro no tenía `.order('nombre')` en el SELECT de Supabase (a diferencia del resto de pantallas de Artículos) — quedaba en orden de inserción en vez de alfabético. Agregado.
- **Vitrina (`/tienda`):** agregadas dos opciones nuevas al combo "Ordenar por" — Alfabético A-Z y Z-A — en `OrdenTienda.tsx` y la lógica de sort de dos niveles en `tienda/page.tsx` (los productos sin stock siempre quedan al final, sin importar el criterio elegido).
- **Obligaciones:** el detalle expandible de cada acreedor mostraba los movimientos en orden ascendente (más viejo arriba), obligando a scrollear hasta el final para ver lo más reciente. El saldo corrido se calcula en orden cronológico ascendente (obligatorio para que sea correcto) y **recién después** se invierte el array solo para el renderizado — así el saldo de cada fila sigue siendo exacto pero en pantalla aparece primero lo más reciente.

### Bloque 7 — Acreedor AFIP renombrado a ARCA + plan de pago de 12 cuotas

Acreedor `id=4` renombrado de "AFIP" a "ARCA" (nombre real vigente del organismo). Se identificaron 2 cargos F931 viejos ($584.352,50 y $400.847,03, sin pagos aplicados) reemplazados por un plan de pago real de 12 cuotas — borrados y reemplazados por un concepto nuevo `Plan de pago` (`conceptos_gasto.id=53`, habilitado para ARCA vía `acreedor_conceptos`) con las 12 cuotas cargadas como Cargos individuales (`fecha_vencimiento` = fecha real de cada cuota, `observaciones` = "Cuota 01/12" ... "Cuota 12/12"), total $1.515.239,75, verificado coincidiendo con el total de la tabla del plan de pago real. En el camino se confirmaron dos columnas obligatorias de `obligaciones` que no estaban documentadas (`categoria_gasto_id`, `usuario_id`).

### Bloque 8 — Investigación de discrepancia de stock: Hydromax Sport Drink 33 gr Naranja (artículo 979)

Surgió al probar el flujo de "Cobrar en caja" desde un pedido de prueba. Conteo físico real: 49 unidades. Stock del sistema en ese momento: 47.

**Se revisó el código del webhook de Mercado Pago (`api/tienda/webhook-mp/route.ts`) y está bien escrito** — usa el circuito correcto (`movimientos_stock` + `movimiento_stock_items`, dejando que el trigger `fn_aplicar_item_stock` aplique el descuento real), sin ningún `UPDATE` directo a `articulo_stock` como el bug que ya se había encontrado y corregido una vez en Compras. GRANTs de `service_role` sobre `movimiento_stock_items` verificados correctos también.

**Se confirmó**, sin embargo, que dos ventas reales de MP para este artículo (ventas #196 y #197, del 08 y 09/08) generaron la cabecera en `movimientos_stock` pero **sin sus filas correspondientes en `movimiento_stock_items`** — movimientos huérfanos, invisibles para Historial de Artículos (que cruza ambas tablas). **La causa exacta no se pudo confirmar**: el plan de Vercel no retiene logs históricos más allá de un rato (confirmado intentando buscar en Logs — solo mostraba desde las 11:16 del día actual), así que el mensaje de error real que hubiera quedado logueado en el momento ya no está disponible. Queda como alerta a vigilar, no como bug confirmado y resuelto — si vuelve a pasar con una venta nueva, revisar Logs de Vercel en modo Live inmediatamente después.

**Corrección de datos aplicada:** se probó agregar un movimiento de "Corrección de stock" (+2) para llevar el registro a 49, pero esto hizo que **Stock Calculado** (la reconstrucción del historial) subiera a 51 en vez de quedar en 49 — porque la base sobre la que se aplicó la corrección (49) ya estaba mal desde antes (le faltaban los 2 egresos nunca registrados). Se revirtió esa corrección (Stock real de por sí ya coincidía con el conteo físico, 49, sin necesidad de ajuste) dejando Ingreso: 49 / Egreso: 0 / Stock Calculado: 49 / Stock real: 49 — todo alineado, sin necesidad de intervención adicional.

**Gap de diseño encontrado en el camino:** `MovimientoStockForm.tsx` excluye a propósito el tipo "Ingreso" de la carga manual (línea con `filter(t => t.id !== ID_INGRESO...)`), asumiendo que todo ingreso real viene de Compras o del Saldo inicial de la migración — esto bloqueó la corrección manual desde la pantalla, se resolvió por SQL directo. Pendiente evaluar si conviene habilitar Ingreso para el motivo puntual "Corrección de stock" sin abrir la puerta a compras cargadas por ese camino.

### Bloque 9 — Limpieza de datos de prueba de la sesión

Pedidos web de prueba sin venta real (ids 1, 3, 4, 5, 6, 10, 11) y sus `ventas_borrador` asociados, eliminados. Venta de prueba #193 (pedido #2, Hydromax Naranja, nunca fiscalizada) revertida completa siguiendo la checklist habitual: `movimiento_stock_items`, `movimientos_stock`, `movimientos`, `venta_pagos`, `venta_items`, `ventas`. Los 3 pedidos reales con CAE confirmado (#7, #8, #9 — ventas #1496/1497/1498) **no se tocaron**, son facturas fiscales reales.

### Bloque 10 — Pedidos Web: cancelación con los 3 casos posibles

Cierre del punto 5 (el último de la lista original de mejoras). Antes de programar se acordó el diseño con Ariel según en qué momento del ciclo de vida está el pedido:

- **Caso simple** (sin venta asociada — `pendiente_pago`, `pendiente_retiro`, `pago_rechazado`, `pago_sin_stock`): botón "Cancelar pedido", solo marca `estado = 'cancelado'`. Nada que revertir.
- **Caso intermedio** (con venta creada pero sin CAE confirmado — el sistema fiscaliza automáticamente al pagar, así que este caso solo se da si la fiscalización falló): botón "Cancelar y anular venta" con confirmación. Revierte stock con un movimiento de Ingreso compensatorio (mismo patrón que "Anular" en Registro de Ventas — vía `movimiento_stock_items`, nunca `UPDATE` directo), anula la venta (`estado_venta_id = 3`), cancela el pedido, y si hubo devolución real de dinero (checkbox + monto + medio de pago), genera el movimiento de Egreso correspondiente (`categoria_gasto_id=14`, `concepto_gasto_id=45`, "Devolución a cliente").
- **Caso delicado** (venta con CAE confirmado): sin botón — solo un texto indicando que requiere Nota de Crédito, circuito todavía no desarrollado (queda documentado acá: **el desarrollo de este caso queda pendiente hasta después de resolver el circuito de Nota de Crédito real**, bloqueado hoy por el constraint `comprobantes.venta_id` UNIQUE).

Sin `CHECK constraint` en `pedidos_web.estado` (confirmado contra producción antes de programar) — el valor `'cancelado'` no necesitó ningún `ALTER TABLE`. Se agregó su etiqueta correspondiente (chip gris "Cancelado") a `ETIQUETAS_ESTADO`, y el filtro "Pendientes de acción" ya lo excluye automáticamente sin tocar nada (por construcción, un pedido cancelado nunca matchea `pendiente_retiro` ni `confirmado sin entregar`).

### Bloque 11 — Compra a DisFit: cálculo de totales (sin cambios de código)

A pedido de Ariel, se analizó un PDF de cuenta corriente completa de DisFit (74 facturas, 11/09/2024 a 30/07/2026) para calcular el total comprado histórico. Resultado: **$44.270.374,16 neto** (descontando 2 Notas de Crédito), promedio mensual **~$1.961.558**, promedio anual **~$23.536.760**, sobre un período real de ~22.6 meses. Sin impacto en el sistema — fue una consulta puntual de análisis de datos del PDF, no una carga a la base.

### Bloque 12 — Vitrina: botón flotante de WhatsApp

Primera pieza de la mejora visual solicitada ("¿quién puede ayudarnos a mejorar visualmente la vitrina?"). Se construyó en el propio código (no se derivó a un tercero) — se ofreció también `Claude Design` como opción para explorar variantes visuales a futuro, sin usarlo esta vez.

Componente nuevo `RedesSocialesFlotantes.tsx` (ver Bloque 14, terminó absorbiendo también Instagram) agregado al `layout.tsx` de `/tienda` — no a cada página suelta — para que aparezca en toda la sección de la Vitrina de una sola vez. Número usado: `5492993244332` (mismo de contacto real del negocio, confirmado contra el sitio de Empretienda vigente).

### Bloque 13 — Vitrina: logo real extraído del brandguide

El PDF del proyecto (`HABITUS_BRANDGUIDE_2025.pdf`) resultó ser internamente un archivo ZIP con las páginas ya rasterizadas en JPEG (no un PDF real navegable con `pdfimages`) — se extrajo con `unzip` en vez del flujo estándar de lectura de PDF. Se usó la página 8 del brandguide ("Versión monocromática"), que tiene el logo completo (símbolo + "HÁBITUS SUPLEMENTOS DEPORTIVOS") en Persian Green sobre fondo oscuro — recortado y con el fondo removido a transparencia por distancia de color (Python/PIL), quedando un PNG limpio de 437×365px, `public/logo-habitus.png`.

**Aviso dejado para el futuro:** esta resolución alcanza para uso chico (header), pero si se necesita más grande (banner grande, impresión) convendría pedirle a VLSQZ (la agencia que hizo el brandguide) el archivo vectorial original.

**Incidente de deploy, 2 veces en la sesión:** el primer `git push` del logo falló por corte de conexión (`Could not resolve host: github.com`) — el commit quedó armado localmente pero nunca llegó a GitHub/Vercel, así que el sitio siguió mostrando la versión vieja hasta el reintento de `git push`. Más adelante en la sesión pasó algo parecido pero distinto: el `push` sí funcionó, pero **un archivo de código nunca se movió de Descargas a su carpeta real** (`tienda_page_con_banners.tsx` se quedó en Descargas mientras solo se movían las imágenes) — el commit correspondiente nunca se generó. Ambos casos se detectaron pidiendo el resultado de `git log --oneline` y comparando contra lo que debería haber quedado commiteado.

### Bloque 14 — Vitrina: Instagram, agrupado con WhatsApp como íconos flotantes

Se agregó inicialmente como link en el footer, pero a pedido de Ariel se movió a un ícono flotante — más visible. Se creó `RedesSocialesFlotantes.tsx` (reemplazando el `BotonWhatsAppFlotante.tsx` original, que quedó huérfano sin uso, no se borró del repo) con los dos íconos apilados: Instagram arriba (con su degradado de marca oficial) y WhatsApp abajo, ambos como SVG dibujados a mano (glifos oficiales reconocibles, no requieren archivo de imagen). Link: `https://www.instagram.com/habitussd/`.

### Bloque 15 — Vitrina: banners de categoría clickeables

Ariel pasó 16 imágenes ya diseñadas (7 de categoría, 5 de marca, 4 institucionales) de una sesión de diseño previa fuera del sistema. Se acordó:
- Arrancar solo con las **6 de categoría con nombre no ambiguo** (Proteínas, Creatinas, Pre-entrenamiento, Colágenos, Quemadores, Bebidas Isotónicas) — se dejó afuera "Cafeínas" porque el rubro real en la base es "Energía", generaría confusión de nombre.
- Las 2 imágenes "Envíos a toda Argentina" **no se usan por ahora** — contradicen la decisión de negocio vigente (solo retiro en local); quedan guardadas para cuando se implemente la fase de envíos (ver pendiente).
- Marcas e institucionales quedan para una segunda pasada, a definir.

**Bug real cometido y corregido en la misma sesión:** al mapear los archivos numerados (`1.png`...`16.png`) subidos por Ariel a las categorías, se calculó mal la correspondencia — el análisis inicial había numerado las imágenes según el orden de aparición en el mensaje ("Imagen 4", "Imagen 5"...), pero `uploaded_files` había llegado con un orden distinto al numérico (arrancaba en `14.png, 15.png, 16.png` y seguía con `1.png`...`13.png`), así que "Imagen 4" en realidad era el archivo `1.png`, no `4.png`. Resultado: `quemadores.png` tenía el contenido de Quemadores real pero bajo el nombre correcto por casualidad en algunos, mal en otros — Ariel lo detectó (banner de "Proteínas" mostraba Quemadores, "Creatinas" mostraba Colágenos, "Pre entreno" mostraba un banner de marca ONE FIT que ni siquiera era de categoría). Se corrigió revisando cada imagen una por una con `view` antes de reasignar, sin necesidad de que Ariel volviera a subir nada — mapeo final correcto: `1.png`→Proteínas, `2.png`→Creatinas, `4.png`→Quemadores, `5.png`→Colágenos, `6.png`→Isotónicas, `7.png`→Pre entreno. **Lección: nunca asumir el orden de archivos subidos coincide con el orden numérico de sus nombres — verificar contenido real antes de nombrar/asignar.**

Implementación: sección `CATEGORIAS_BANNER` en `tienda/page.tsx`, visible solo en la vista "landing" (sin filtro ni búsqueda activa) para no saturar cuando el cliente ya está navegando filtrado — cada banner enlaza a `/tienda?rubro=<Categoría>`, reutilizando el mecanismo de filtro ya existente sin tocar `FiltrosTienda.tsx`. Imágenes pesadas (350-570 KB cada una, PNG sin comprimir) — con `loading="lazy"` por ahora, pendiente comprimir/convertir a WebP si se nota lento en el celular.

### Bloque 16 — Vitrina: rediseño del header y footer

Cierre de la mejora visual. Header: se sacó la glosa de dirección (quedó solo el logo, ahora con link a `/tienda` y centrado respecto al ancho completo usando el carrito posicionado con `absolute` aparte, para que no lo empuje del centro). Footer: reemplazado el texto chico de una línea por un bloque negro (`bg-charcoal`, mismo estilo que el header) con email, teléfono (mismo número que WhatsApp, clickeable para llamar) y dirección completa, cada uno con su ícono — **decisión de criterio tomada y confirmada con Ariel: íconos monocromáticos en Persian Green**, no multicolor, para no romper la paleta estricta de 3 colores del `DESIGN.md` ("Efficient Workshop", utilitario y plano).

### Bloque 17 — Fix menor de Vitrina + fix de validación en cancelación + TERCER caso confirmado del bug de stock huérfano

**Glosa "Categorías" removida** de arriba de los banners en `/tienda` — redundante, los banners ya se explican solos.

**Fix real de validación en `cancelarYAnularVenta` (Pedidos Web):** el formulario de cancelación con devolución permitía confirmar con el checkbox "Hubo devolución de dinero" tildado pero sin monto cargado — la función seguía de largo en silencio, sin crear el movimiento de Egreso ni avisar nada. Corregido con una validación temprana (antes de tocar cualquier tabla) que frena y muestra error si falta monto o medio de pago cuando el checkbox está tildado.

**Caso real que disparó el hallazgo:** Enzo Vega hizo un pedido web (#12, venta #1525/id real 224) el 12/08 a la noche, Ariel lo canceló y le devolvió $1.000 por transferencia desde su MP personal — pero como no cargó el monto en el formulario, el Egreso nunca se registró. Se reconstruyó a mano:
```sql
INSERT INTO movimientos (sucursal_id, tipo, categoria_gasto_id, concepto_gasto_id, medio_pago_id, monto, fecha_utc, mes_contable, origen_tipo, origen_id, observaciones, usuario_id)
VALUES (1, 'Egreso', 14, 45, 4, 1000, '2026-08-12', '2026-08-01', 'venta', 224, 'Devolución a Enzo Vega...', <usuario_id>);
```
**Nota importante de investigación:** en el camino se sospechó erróneamente que el Ingreso original de esa venta tampoco existía — resultó ser un error de consulta (se buscó por `numero_venta`=1525 en vez del `id` real=224, dos columnas distintas de `ventas`). El Ingreso original **sí estaba bien registrado desde el principio**. Lección: `numero_venta` (lo que ve el usuario) y `id` (lo que usan las FK como `origen_id`) no son lo mismo — nunca asumir que coinciden.

**TERCER caso confirmado del bug de stock huérfano** (mismo patrón que Bloque 8, sesión anterior — ventas #196/#197): la venta #224 (pedido #12) tampoco descontó stock real al momento del pago. Se confirmó con:
```sql
SELECT id, origen_tipo, origen_id, creado_en, observaciones FROM movimientos_stock WHERE origen_tipo='venta' AND origen_id=224;
-- id 395 (00:28, "Venta web #1525 — pedido 12") — SIN ítems en movimiento_stock_items
-- id 396 (00:48, "Reversión por cancelación de pedido web #12") — CON su ítem (+1)
```
Como la reversión de la cancelación asumió que el descuento original sí se había aplicado, el stock real quedó con **1 unidad de más** de lo que correspondía (48 en sistema vs 47 real). Corregido manualmente vía `/stock/nuevo` (Egreso, motivo "Corrección de stock", cantidad 1 — esta vez sí posible desde la pantalla, es Egreso no Ingreso).

**Con 3 casos confirmados (ventas #196, #197, #224), esto deja de ser "a vigilar" y pasa a ser un patrón real y recurrente.** El código del webhook se revisó 3 veces y está bien escrito — la sospecha es algo intermitente (timeout de función serverless en el plan actual de Vercel, condición de carrera, o un límite/hiccup puntual de Supabase en el segundo `INSERT` de la secuencia). No se puede resolver a ciegas sin atrapar el error real la próxima vez que ocurra — **sube a prioridad alta para la próxima sesión.**

### Pendiente general para la próxima sesión (por prioridad)
1. **🔴 ALTA — Investigar la causa raíz del bug de stock huérfano en el webhook de MP** (3 casos confirmados: ventas #196, #197, #224). Estrategia sugerida: apenas se detecte una venta nueva con este patrón, entrar a Logs de Vercel en modo Live de inmediato (la retención es corta) y buscar el mensaje de error real (`Error al descontar stock de venta web`). Mientras tanto, después de cualquier cancelación de pedido web con venta asociada, conviene verificar en Historial de Artículos que el stock cuadre — es el único parche disponible por ahora.
2. Envíos a domicilio en la Vitrina (fase posterior a "solo retiro en local") — decisión de negocio. 2 banners "Envíos a toda Argentina" guardados sin usar para cuando se retome.
3. Feature nueva: "Avisarme cuando haya stock" — botón en productos sin stock que abre un diálogo pidiendo email, guarda en tabla nueva (a diseñar), y al confirmar una Compra que reponga ese artículo, dispara un mail automático a los interesados. Requiere definir proveedor de envío de mails (hoy el sistema no tiene ninguno integrado).
4. Banners de marca e institucionales (medios de pago) — segunda pasada de la mejora visual de la Vitrina.
5. Evaluar si habilitar tipo "Ingreso" en `MovimientoStockForm.tsx` para el motivo "Corrección de stock".
6. Confirmar en la práctica que el aviso de "1 pedido web pendiente de acción" del Dashboard se actualiza correctamente al resolver el pedido.
7. Circuito de Nota de Crédito real (bloqueado por constraint `comprobantes.venta_id` UNIQUE) — desbloquea el caso "delicado" de cancelación de Pedidos Web.
8. Pantalla "Correcciones" para Admin, resync de sandbox, permisos granulares de Agustín.
9. Comprimir las 6 imágenes de banners de categoría si se nota lenta la carga inicial de `/tienda` en el celular.
10. Actualizar `MAPA-ARCHIVOS.md` con todos los archivos nuevos/tocados de las últimas 2 sesiones.
