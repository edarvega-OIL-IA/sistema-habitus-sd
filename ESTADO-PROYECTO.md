# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 25/07/2026 — Jornada larga dedicada al sistema de Sabores estándar para armar la glosa de precios (WhatsApp/IG): tabla `sabores` (26 cargados) + columna `articulos.sabor_id` + trigger que arma el `nombre` solo; tabla `componentes`/`articulo_componentes` (filtro "¿tenés algo con cafeína?"); 5 rubros migrados con `nombre_base`/sabor (Proteínas 74, Creatinas 32, Barras de proteína 43, Geles 59, Bebidas Isotónicas 19); fusión de rubro Geles Cafeina→Geles; baja completa de la marca GU Energy salvo 1 artículo; rediseño de la solapa Identificación en `ArticuloForm.tsx` (Sabor + Nombre autogenerado); fix del gap de "Duplicar artículo" (ahora copia Nombre base y exige Sabor distinto); y feature nueva: botón **"Generar glosa"** en Administrar Artículos que arma el texto de WhatsApp/Instagram agrupado por sabor, listo para copiar.
**Estado general:** 🟢 En producción. El motor de agrupación por sabor quedó construido y probado de punta a punta (base de datos + formulario + glosa), con 5 de los ~20 rubros del catálogo ya migrados.
**Próxima acción concreta:** Seguir migrando rubros al sistema de sabores — candidatos siguientes por volumen: Salud y bienestar (35), Shakers (30), Pre-entrenamiento (26), Colágenos (25). Resolver el duplicado viejo "Bcaa 2000 - 120 Cápsulas" (arrastrado desde antes de esta sesión, sin decidir todavía). Retomar el diseño de "Medida"/"Cantidad" para filtros web (Gr/Kg/Lb/Cápsulas), discutido pero sin ejecutar. Actualizar `MAPA-ARCHIVOS.md` y `CLAUDE_CODE_PROMPT.md` con todo lo de esta sesión (ver sección 22).

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas) — **tiene correcciones pendientes de aplicar, ver secciones 21 y 22**
- `MAPA-ARCHIVOS.md` — índice de rutas: qué hace cada archivo .tsx/.ts del proyecto — **desactualizado, faltan los archivos de las sesiones 22/07 y 25/07 (ver secciones 21 y 22)**
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
- [ ] **Migrar el resto de los rubros al sistema de Sabores** (`nombre_base` + `sabor_id`) para que la glosa los agrupe — Salud y bienestar (35), Shakers (30), Pre-entrenamiento (26), Colágenos (25), Aminoácidos (21), Óxido Nítrico (13), Quemadores (12), Foods (12), Ganadores de peso (11), Proteínas Vegetales (10), Multivitamínicos (9), Glutamina (8), Energía (7), Pro Hormonal (7), Sales (5). Ver sección 22 para el mecanismo (Excel + `UPDATE` en lote).
- [ ] **Duplicado real sin resolver:** "Bcaa 2000 - 120 Cápsulas" (2 ids activos) — detectado hace varias sesiones, sigue sin decidirse cuál de los dos desactivar.
- [ ] Tabla `tipos_medida` (Gr/Kg/Lb/Cápsulas...) + columnas `medida_tipo_id`/`cantidad_medida` en `articulos`, para filtros de la vitrina web — diseño conversado con Ariel (ver sección 22), sin SQL ejecutado todavía.
- [ ] Sumar más `componentes` cuando se migren Pre-entrenamiento/Óxido Nítrico (Taurina, Arginina, Citrulina, Beta-Alanina) y Colágenos (Resveratrol) — hoy la tabla `componentes` solo tiene Cafeína.
- [ ] Actualizar `MAPA-ARCHIVOS.md` y `CLAUDE_CODE_PROMPT.md` con lo de la sesión 25/07 (tabla `sabores`, `componentes`, `articulo_componentes`, columna `articulos.sabor_id`, trigger `fn_generar_nombre_articulo`, cambios en `ArticuloForm.tsx` y `articulos/page.tsx`).

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
