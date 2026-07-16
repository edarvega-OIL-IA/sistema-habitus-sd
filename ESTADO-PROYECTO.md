# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 14/07/2026 — **Fiscalización AFIP/ARCA vía TusFacturasAPP ACTIVA EN PRODUCCIÓN REAL.** `FISCALIZACION_TUSFACTURAS_ACTIVA=true` en Vercel desde hoy. Primera venta real fiscalizada desde el sistema propio (no Cover) emitida con éxito. Se encontraron y corrigieron 8+ bugs durante la activación (todos documentados en sección 19). Las 2 ventas de prueba realizadas durante la validación fueron anuladas correctamente mediante Notas de Crédito C reales (no con SQL, porque ya tenían CAE real de ARCA).
**Estado general:** 🟢 Sistema en producción real y **fiscalizando de verdad**. Módulos Compras, Ventas, Editar ítems, Caja, Dashboard, Movimientos, pantalla unificada de Precios, Fiscalización AFIP/ARCA: todos estables y en uso real.
**Próxima acción concreta:** Seguir de cerca las próximas ventas reales fiscalizadas por el personal del local (Agustín incluido) para detectar cualquier caso no cubierto en las pruebas (ej. venta con múltiples ítems, venta con cliente real con CUIT/DNI cargado — todavía no probado, solo Consumidor Final). Definir si la baja de Cover (objetivo original 12/07, vencido) ya puede confirmarse ahora que la fiscalización real funciona.

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `MAPA-ARCHIVOS.md` — índice de rutas: qué hace cada archivo .tsx/.ts del proyecto
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
| Facturación AFIP/ARCA | **TusFacturasAPP — EN PRODUCCIÓN REAL desde 14/07/2026** |
| Pagos (MVP v2) | Mercado Pago (webhooks) |
| Tipografía sistema | Inter (Google Fonts) — reemplaza Geist |
| Modo offline | No contemplado |

---

## 4. Módulos confirmados (orden de prioridad)

1. Artículos / Inventario ✅
2. Órdenes de Compra ✅
3. Movimientos de Stock ✅
4. Ventas (carrito, modo POS, multi-pago) ✅
5. Registro de Ventas ✅
6. Movimientos financieros (ledger único) ✅
7. Caja ✅
8. Dashboard ✅
9. Reportes — pendiente
10. **Facturación AFIP automática — ✅ EN PRODUCCIÓN REAL (14/07/2026)**
11. Vitrina web propia (reemplaza Empretienda) — post-MVP
12. Team Habitus (sponsoreo a deportistas, a costo) — post-MVP

---

## 5. Infraestructura Supabase

- Organización: **Camino Doce Doce - IT**
- **Producción:** habitus-sd-production (ref: lfscdxrhwjpkkirxzhwt, AWS sa-east-1, Pro ~USD25/mes)
- **Sandbox:** habitus-sd-sandbox (AWS sa-east-1, plan Free) — desincronizado, replicar toda la integración TusFacturasAPP cuando haya ventana
- `.env.local` → producción | `.env.development.local` → sandbox
- **Deploy:** https://sistema-habitus-sd.vercel.app (GitHub, auto-deploy en push)
- **Variables de entorno en Vercel (Production+Preview, todas Sensitive):** `TUSFACTURAS_APIKEY`, `TUSFACTURAS_APITOKEN`, `TUSFACTURAS_USERTOKEN`, y desde 14/07 también **`FISCALIZACION_TUSFACTURAS_ACTIVA=true`** (ya NO está inactiva — el interruptor está prendido).

---

## 6. Decisiones pendientes

- [ ] Pantalla "Correcciones" (admin, rol_id=1) para ventas de turnos ya cerrados
- [ ] **Circuito de Nota de Crédito (NC) real dentro del sistema** — hoy la emisión de NC se hizo a mano por fuera del sistema (PowerShell + API directa) para corregir 2 ventas de prueba (ver sección 19). Falta: pantalla/función para emitir NC desde el sistema, y **resolver el gap de esquema** `comprobantes.venta_id` es `UNIQUE` — no permite guardar más de un comprobante por venta (bloquea guardar la NC como fila en `comprobantes`). Mientras tanto, las NC quedan documentadas en `ventas.observaciones` como workaround.
- [ ] Limpiar políticas RLS duplicadas restantes si aparecen nuevas
- [ ] Confirmar los 4 archivos marcados `[?]` en `MAPA-ARCHIVOS.md`: `configuracion/page.tsx`, `reportes/page.tsx`, `page.tsx` raíz, `lib/utils.ts`
- [ ] Borrar `compras/[id]/page_compras_id_old.tsx` y `src/app/(sistema)/diagnostico/`
- [ ] Tipografías web: licenciar Antique Olive Nord D + Futura MD BT, o alternativas Google Fonts
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2 filas amarillas: −$28.000 del 30/06/2026)
- [ ] Pantalla de ABM de Categorías y Conceptos de movimientos (post-MVP)
- [ ] Reorganización del menú lateral (post-MVP)
- [ ] Editar historial de cierres de caja (Admin, pantalla separada) — post-MVP
- [ ] Indicador de rentabilidad caída en listado de artículos
- [ ] Sandbox sigue sin toda la integración TusFacturasAPP — replicar cuando haya ventana
- [x] ~~MVP v2: fiscalización AFIP/ARCA vía TusFacturasAPP~~ — **EN PRODUCCIÓN REAL desde 14/07/2026**
- [ ] **Pantalla de historial de movimientos por artículo** — vista maestro-detalle: grilla de artículos con totales Ingreso/Egreso/Stock, al expandir muestra línea de tiempo cronológica (fecha, tipo, comprobante, responsable/origen, precio, stock calculado corrido). Cubre Ingresos (Compras) y Egresos (Ventas, Regalado, Vencido, Consumo interno, Team Habitus). Referencia de diseño: pantalla "Administrar Artículos" de Cover (capturas guardadas en el chat de la sesión 15/07/2026) — rescatar el patrón maestro-detalle y la columna de stock calculado corrido (útil para detectar descuadres); NO copiar el patrón de "Egreso (Ajuste)" con texto libre sin trazar — en nuestro sistema ya se resuelve mejor con `origen_tipo`/`origen_id` estructurado, se puede linkear directo a la Orden de Compra o Venta real en vez de solo describirla en texto. Definir antes de construir: si "Regalado" y "Vencido" necesitan `subtipos_movimiento_stock` nuevos (hoy solo existen Consumo interno, Merma, Sponsoreo) o si "Vencido"/"Regalado" ya están cubiertos por alguno existente.
- [ ] Definir si la baja de Cover (objetivo 12/07, vencido) ya puede confirmarse ahora que la fiscalización real está validada
- [ ] Ariel debe retirar físicamente $200 de la caja (efectivo real cobrado durante las 2 ventas de prueba, ya anuladas fiscalmente vía NC pero el dinero físico entró de verdad)
- [ ] Probar fiscalización con cliente real (CUIT o DNI cargado) — todo lo probado hasta ahora fue Consumidor Final sin datos
- [ ] Probar fiscalización con venta de múltiples ítems (todo lo probado fue de 1 solo ítem)
- [ ] Evaluar si conviene trackear la numeración de Notas de Crédito en `numeracion_comprobantes` (hoy se le pidió a TusFacturasAPP que asigne el número automáticamente, sin fila propia en esa tabla para `tipo_comprobante_id=3`)
- [ ] Crear concepto de gasto específico "TusFacturasAPP" ya usado en el primer pago mensual (categoría Sistema, id=8) — confirmar que quedó bien cargado

---

## 12. Fiscalización AFIP/ARCA — EN PRODUCCIÓN REAL (actualizado 14/07/2026)

### Estado: ACTIVO
- `FISCALIZACION_TUSFACTURAS_ACTIVA=true` en Vercel desde 14/07/2026.
- Primera venta real fiscalizada desde el sistema propio (no Cover): **Factura C 00004-00000002**, CAE `86283796388165`, $1.800, Consumidor Final.
- Segunda venta real con descuento general (94%): **Factura C 00004-00000003**, CAE `86283800773414`, total $100.
- Ambas fueron ventas de prueba (con datos de descuento extremos para validar el circuito) y se anularon correctamente con Notas de Crédito C reales — ver sección 19 para el detalle completo.

### Bugs encontrados y corregidos durante la activación (14/07/2026)
Ver sección 19 para el detalle técnico completo. En resumen: falta de política RLS `UPDATE` en `comprobantes`, campo `vencimiento` faltante (obligatorio desde 01/10/2023), campo `bonificacion` no calculado (rompía ventas con descuento), 8 campos obligatorios faltantes en el JSON (`idioma`, `periodo_facturado_desde/hasta`, `cliente.codigo`, `cliente.rg5329`, `producto.unidad_medida/actualiza_precio/rg5329`, `detalle.afecta_stock`), y un bug de nombre de campo en la respuesta (`vencimiento_cae` no `cae_vencimiento`) que causaba un crash *después* de que ARCA ya hubiera emitido el CAE con éxito.

### Gap de diseño encontrado (no resuelto, documentado como pendiente)
`comprobantes.venta_id` tiene restricción `UNIQUE` — el esquema original asume 1 venta = 1 comprobante y no contempla que una venta pueda tener además una Nota de Crédito asociada. Bloqueó guardar las NC como filas en `comprobantes`; se documentaron en su lugar en `ventas.observaciones` como workaround temporal. Ver sección 6, ítem pendiente de circuito de NC.

---

## 19. Sesión 14/07/2026 — Activación real de TusFacturasAPP: bugs encontrados, corregidos, y primera factura real emitida

### Contexto de arranque
Continuando desde la sesión 13/07 (pipeline construido y desplegado, inactivo). Ariel en el local, listo para activar.

### Paso 1 — Regularización de ventas del período paralelo con Cover
6 ventas (#1350 a #1355) que habían quedado en "Pend. fiscal" porque se facturaron en Cover durante el período paralelo, se reclasificaron a `estado_venta_id=5` ("Fiscalizado externamente") — mismo patrón ya usado en sesión 08/07 para las 19 ventas anteriores.

### Paso 2 — Activación
`FISCALIZACION_TUSFACTURAS_ACTIVA=true` agregada en Vercel + redeploy.

### Paso 3 — Primer intento real: rechazo por campo `vencimiento` faltante
Venta de prueba $100 efectivo → TusFacturasAPP rechazó: *"El formato de fecha de vencimiento no es válido"* + *"La fecha de vencimiento del comprobante es menor a la fecha del comprobante"*. Causa real: el campo `comprobante.vencimiento` (obligatorio desde el 01/10/2023 según el changelog oficial de TusFacturasAPP) directamente no se estaba enviando en el JSON. **Fix:** agregado `vencimiento = fecha` (mismo día, porque `condicion_pago="201"` = Contado = 0 días de plazo).

### Bug colateral encontrado: falta política RLS UPDATE en `comprobantes`
Al revisar por qué el comprobante rechazado había quedado en estado `Pendiente` en vez de `Rechazado`, se encontró que la tabla `comprobantes` solo tenía políticas RLS de `INSERT` y `SELECT` — le faltaba `UPDATE` (ni política ni GRANT). Los `UPDATE` que hace el código para marcar CAE recibido o rechazo fallaban en silencio. **Fix:**
```sql
CREATE POLICY comprobantes_update ON comprobantes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT UPDATE ON comprobantes TO authenticated;
```

### Paso 4 — Segundo intento: rechazo por inconsistencia `total` vs `detalle`
Venta de prueba con 94% de descuento general ($1.800 → $100) → TusFacturasAPP rechazó por inconsistencia entre la suma del `detalle` ($1.800) y el `total` enviado ($100). El campo `bonificacion` del comprobante estaba hardcodeado en `"0.00"`. **Fix:** `bonificacion = suma del detalle − total final`, calculado dinámicamente en `mapearVentaAFacturaC`.

### Paso 5 — Tercer intento: rechazo por desalineación de numeración ante ARCA
Cada rechazo anterior (antes de llegar a ARCA) **igual consumía un número de nuestro contador interno** (`numeracion_comprobantes`), pero ARCA nunca llegó a recibir esos números — quedó desalineado (nuestro contador en 5, ARCA esperando el 2). **Fix:** se resetearon manualmente varias veces `numeracion_comprobantes.ultimo_numero` durante la sesión, y se identificó que los comprobantes rechazados/huérfanos (con `factura_cae IS NULL`) debían borrarse físicamente de `comprobantes` (a diferencia de las ventas, que nunca se borran) porque colisionaban con la restricción `UNIQUE(punto_venta_id, tipo_comprobante_id, numero)` al reintentar.

### Paso 6 — Revisión exhaustiva de campos contra la documentación oficial (antes de seguir por prueba y error)
Se decidió pausar el ciclo de prueba-y-error y revisar el JSON completo campo por campo contra la "Referencia API AFIP ARCA" oficial. Se encontraron **8 campos obligatorios faltantes que nunca se habían enviado**:
- `comprobante.idioma` (REQUERIDO)
- `comprobante.periodo_facturado_desde` / `periodo_facturado_hasta` (REQUERIDO)
- `cliente.codigo` (REQUERIDO)
- `cliente.rg5329` (REQUERIDO)
- `producto.unidad_medida` (REQUERIDO)
- `producto.actualiza_precio` (REQUERIDO)
- `producto.rg5329` (REQUERIDO)
- `detalle.afecta_stock` (REQUERIDO)

Se corrigieron todos de una vez en `tipos.ts` y `mapeo.ts`.

### Paso 7 — ¡Primera factura real exitosa!
Venta #1367 (venta_id=74), $1.800 sin descuento, efectivo → **Factura C 00004-00000002, CAE 86283796388165, vencimiento CAE 24/07/2026**. Confirmado visualmente en el panel de TusFacturasAPP y en el PDF oficial con QR de ARCA.

### Bug post-éxito encontrado: nombre de campo incorrecto en la respuesta
Una segunda prueba devolvió `"Cannot read properties of undefined (reading 'split')"` — inicialmente se sospechó de un rechazo, pero investigando se confirmó que **el comprobante había sido aceptado con éxito por ARCA** y el error era nuestro, al intentar leer `respuesta.cae_vencimiento` cuando el campo real en la respuesta se llama **`vencimiento_cae`** (nombres invertidos respecto a lo que se había asumido). También se agregó `.trim()` al CAE (la documentación aclara que puede venir con un espacio final). **Este fue un hallazgo importante: hubo que verificar manualmente en el panel de TusFacturasAPP que no se estuviera por anular una factura real por error de interpretación del código.**

### Paso 8 — Segunda factura real exitosa, con descuento
Venta #1368 (venta_id=75), $1.800 subtotal con $1.700 de descuento general → total $100 → **Factura C 00004-00000003, CAE 86283800773414**. Confirma que el fix de `bonificacion` también quedó correcto.

### Paso 9 — Regularización de las 2 ventas de prueba (ya con CAE real, no se pueden anular por SQL)
Según la documentación oficial de TusFacturasAPP: *"Aquellos comprobantes que hayan impactado en AFIP, no podrán ser eliminados. Sólo pueden ser anulados contablemente generando una Nota de Crédito."* Se decidió por la opción prolija (NC real) en vez de simplemente aceptar las ventas de prueba como reales.

Se emitieron 2 Notas de Crédito C reales, llamando directamente a la API de TusFacturasAPP desde PowerShell (fuera del sistema, como acción administrativa puntual):
- **NC 00004-00000001**, CAE `86283802682152`, anulando Factura C 00004-00000002 (venta_id=74, $1.800)
- **NC 00004-00000002**, CAE `86283802918959`, anulando Factura C 00004-00000003 (venta_id=75, $100)

Al intentar registrar las NC como filas nuevas en `comprobantes`, se encontró que **`comprobantes.venta_id` tiene restricción `UNIQUE`** — el esquema no contempla más de un comprobante por venta. Se documentó como gap pendiente (ver sección 6) y, como workaround, las NC quedaron registradas en `ventas.observaciones` de cada venta, con número de NC y CAE.

Se revirtió stock (movimiento de Ingreso compensatorio) y el movimiento financiero (ledger) de ambas ventas, y se marcaron como `estado_venta_id=3` (Anulada). **Pendiente:** Ariel debe retirar físicamente $200 de la caja (el efectivo de las 2 pruebas entró de verdad, aunque las facturas ya estén anuladas fiscalmente).

### Aprendizaje adicional: por qué las facturas figuran "Impaga" en TusFacturasAPP (no es un bug)
Nuestro JSON no envía el bloque `"pagos"` del comprobante — la información de cómo se cobró la venta ya vive en nuestra propia tabla `venta_pagos`, no tiene sentido duplicarla en TusFacturasAPP. Por eso, en el panel de TusFacturasAPP, toda factura emitida desde el sistema aparece como "Impaga" en su gestión interna de cuentas corrientes (aunque en la realidad ya esté cobrada en nuestro sistema). Confirmado con el CSV exportado de TusFacturasAPP: al emitir las 2 Notas de Crédito, se activó automáticamente la función de **auto-acreditación** de TusFacturasAPP (documentada oficialmente: se dispara cuando la NC anula un solo comprobante, por el importe exacto, y ese comprobante estaba impago al 100%) — generó un "recibo de cobro" interno que pasó ambas facturas a "Pagada" en su plataforma. Es solo gestión interna de TusFacturasAPP, no afecta nada de nuestro sistema ni de ARCA. Relevante para tener en cuenta si en el futuro se construye el circuito de NC dentro del sistema.

### Archivos modificados en esta sesión
- `src/lib/tusfacturas/tipos.ts` — agregados: `vencimiento`, `idioma`, `periodo_facturado_desde/hasta` en `TusFacturasComprobante`; `codigo`, `rg5329` en `TusFacturasCliente`; `unidad_medida`, `actualiza_precio`, `rg5329` en `TusFacturasProducto`; `afecta_stock` en `TusFacturasDetalleItem`; renombrado `cae_vencimiento` → `vencimiento_cae` en `TusFacturasRespuestaExito` (nombre real del campo).
- `src/lib/tusfacturas/mapeo.ts` — cálculo dinámico de `bonificacion` (subtotal detalle − total), completados los 8 campos obligatorios nuevos en las 3 ramas de `resolverCliente` y en el armado de `detalle`.
- `src/app/api/ventas/route.ts` — corregida la referencia a `respuesta.vencimiento_cae` (antes `respuesta.cae_vencimiento`) + `.trim()` en el CAE. (Nota operativa: en esta sesión el archivo se copió por error a `src/lib/tusfacturas/route.ts` en un primer intento — corregido moviéndolo a la ruta real `src/app/api/ventas/route.ts`.)

### SQL ejecutado en producción (además de las políticas RLS ya mencionadas)
- Reseteos múltiples de `numeracion_comprobantes.ultimo_numero` para el PV 0004 / tipo Factura durante el troubleshooting.
- `DELETE FROM comprobantes WHERE punto_venta_id=3 AND tipo_comprobante_id=1 AND factura_cae IS NULL` — limpieza de comprobantes huérfanos/rechazados sin CAE real.
- Anulación completa (reversión de stock + ledger + `estado_venta_id=3`) de las ventas fallidas: ids 69, 70, 71, 72, 73 (numero_venta 1362 a 1366) y, con el workaround de NC, las ventas 74 y 75 (numero_venta 1367 y 1368).
- Creado concepto de gasto `TusFacturasAPP` dentro de categoría `Sistema` (id=8), para clasificar el pago mensual de la suscripción de forma específica en vez de "Otro sistema".

### Estado final de `numeracion_comprobantes` (PV 0004)
- `tipo_comprobante_id=1` (Factura): `ultimo_numero=3` (00004-00000001 = prueba manual de sesión anterior, 00004-00000002 y 00004-00000003 = las 2 ventas de prueba de hoy, ya anuladas con NC — la numeración real de ARCA **no tiene huecos**, solo nuestras ventas asociadas están anuladas).
- `tipo_comprobante_id=3` (Nota de Crédito): sin fila propia todavía — se dejó que TusFacturasAPP asigne el número automáticamente. Pendiente evaluar si conviene trackearlo internamente cuando se construya el circuito completo de NC.

### Pendiente para la próxima sesión
1. Confirmar que Ariel retiró los $200 de la caja física.
2. Seguir de cerca las próximas ventas reales del local (Agustín incluido).
3. Probar fiscalización con cliente real (CUIT/DNI) y con múltiples ítems — no probado todavía.
4. Diseñar el circuito completo de Nota de Crédito dentro del sistema, resolviendo el gap de `comprobantes.venta_id UNIQUE`.
5. Definir con Ariel si la baja de Cover ya puede confirmarse.
6. Replicar toda la integración TusFacturasAPP en sandbox (sigue desincronizado).
