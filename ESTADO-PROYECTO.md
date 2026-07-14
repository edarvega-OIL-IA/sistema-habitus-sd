# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 13/07/2026 — Pipeline completo de fiscalización AFIP/ARCA vía TusFacturasAPP construido y desplegado a producción, **inactivo a propósito** (gateado por variable de entorno) hasta que Ariel decida activarlo. Bloqueante de IP resuelto (wildcard `*`). Punto de venta 0004 cargado en `puntos_venta`. Numeración de comprobantes confirmada para ese punto de venta.
**Estado general:** 🟢 Sistema en producción real. Módulos Compras, Ventas, Editar ítems, Caja, Dashboard, Movimientos, pantalla unificada de Precios: estables. Fiscalización real vía TusFacturasAPP: código listo end-to-end, esperando que Ariel la active manualmente (variable `FISCALIZACION_TUSFACTURAS_ACTIVA=true` en Vercel) — planeado para el 14/07 en el local, con una venta real de prueba.
**Próxima acción concreta:** 14/07/2026 en el local — Ariel activa `FISCALIZACION_TUSFACTURAS_ACTIVA=true` en Vercel + redeploy, y hace una venta real fiscalizada de prueba con el sistema propio (primera factura C real emitida automáticamente desde Sistema Habitus SD, no desde Cover). Seguir el resultado en vivo por si hace falta ajustar algo. En paralelo: seguir pendiente la baja de Cover (~12/07, ya vencido el objetivo original, revisar con Ariel si sigue en pie la fecha).

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `MAPA-ARCHIVOS.md` — índice de rutas: qué hace cada archivo .tsx/.ts del proyecto (creado 07/07, actualizar al cierre de cada sesión cuando cambien archivos — **pendiente actualizar con los 4 archivos nuevos de esta sesión**, ver sección 18)
- `supabase/01_referencia.sql` ✅ al `supabase/08_cierre_turno.sql` ✅ — todos ejecutados
- `supabase/agregar_origen_subtipo.sql` — ejecutado en producción, PENDIENTE en sandbox
- `supabase/limpieza_arranque.sql` — ejecutado en producción (01/07)
- `supabase/numeracion_comprobantes_pv0004.sql` — ejecutado en producción (13/07), no aplicó cambios porque la fila ya existía (ver sección 18)

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
| Facturación AFIP/ARCA | **TusFacturasAPP — cuenta creada, punto de venta enlazado, plan API contratado, pipeline de código completo y desplegado, inactivo hasta activación manual** |
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
10. Facturación AFIP automática — **código completo, desplegado, inactivo** (ver sección 18)
11. Vitrina web propia (reemplaza Empretienda) — post-MVP
12. Team Habitus (sponsoreo a deportistas, a costo) — post-MVP

---

## 5. Infraestructura Supabase

- Organización: **Camino Doce Doce - IT**
- **Producción:** habitus-sd-production (ref: lfscdxrhwjpkkirxzhwt, AWS sa-east-1, Pro ~USD25/mes) — en uso real desde 29/06/2026
- **Sandbox:** habitus-sd-sandbox (AWS sa-east-1, plan Free) — usado para pruebas, con drift periódico respecto a producción
- `.env.local` → producción | `.env.development.local` → sandbox
- **Deploy:** https://sistema-habitus-sd.vercel.app (GitHub, auto-deploy en push)
- **Variables de entorno nuevas en Vercel (13/07):** `TUSFACTURAS_APIKEY`, `TUSFACTURAS_APITOKEN`, `TUSFACTURAS_USERTOKEN` (todas marcadas Sensitive, Production+Preview). `FISCALIZACION_TUSFACTURAS_ACTIVA` **sin crear todavía** — a propósito, es el interruptor general de la fiscalización real.

---

## 6. Decisiones pendientes

- [ ] Pantalla "Correcciones" (admin, rol_id=1) para ventas de turnos ya cerrados — usa columnas `corregido_por_usuario_id`, `corregido_en`, `motivo_correccion` (ya en producción)
- [x] ~~`concepto_gasto_id` correcto para "Egreso por devolución a cliente"~~ — resuelto: `categorias_gasto` id=14 (Devoluciones), `conceptos_gasto` id=45 (Devolución a cliente)
- [ ] Circuito de Nota de Crédito (Caso B: venta ya fiscalizada con diferencia de dinero) — depende de tener fiscalización real activa (ya está el código base, falta activarlo y luego diseñar NC)
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
- [ ] Sandbox sigue sin los cambios de Compras de sesión 15, sin las tablas/columnas nuevas de las sesiones siguientes, y ahora tampoco tiene nada de la integración TusFacturasAPP — replicar cuando haya ventana
- [x] ~~MVP v2: fiscalización AFIP/ARCA vía TusFacturasAPP (cuenta todavía no creada)~~ — cuenta creada, punto de venta enlazado, plan API contratado, **código completo desplegado**. Pendiente real: **activar el interruptor** (`FISCALIZACION_TUSFACTURAS_ACTIVA=true`) y hacer la primera venta real fiscalizada (planeado 14/07)
- [ ] Auditar el resto de pantallas con inputs de monto por si tienen el mismo problema de decimales (no se hizo una revisión exhaustiva de todo el sistema)
- [ ] Definir si la fecha objetivo de baja de Cover (12/07) sigue en pie, dado que la activación real de TusFacturasAPP recién se prueba el 14/07

---

## 7. Pantallas operativas al cierre de sesión 10

*(sin cambios — ver secciones posteriores para todo lo agregado desde entonces)*

---

## 12. Fiscalización AFIP/ARCA — actualización 13/07/2026 (ver también sección 18)

### Estado actual de TusFacturasAPP
- Cuenta creada (edarvega@gmail.com).
- Punto de venta **0004** dado de alta en ARCA (distinto del 0003 que usa Cover) y en TusFacturasAPP, con enlace ARCA completo (7 pasos) y certificado cargado.
- **Facturación real ya probada con éxito**: Factura C 00004-00000001, CAE real emitido (venta de prueba $500, irreversible).
- Plan pagado: API26 1K4C, $33.000/mes IVA incluido, 4 puntos de venta, 1.000 comprobantes/mes, vigente 13/07/2026–12/08/2026.
- Bloqueante de IP resuelto: campo "IP habilitada" configurado con wildcard `*` (soporte de TusFacturasAPP lo recomendó para plataformas serverless como Vercel, que no tienen IP de salida fija).
- Credenciales de API cargadas como variables de entorno en Vercel (nunca hardcodeadas ni en el repo): `TUSFACTURAS_APIKEY`, `TUSFACTURAS_APITOKEN`, `TUSFACTURAS_USERTOKEN`.

### Pipeline de código — completo (ver sección 18 para el detalle técnico)
Construido, revisado contra la documentación oficial de TusFacturasAPP (no asumido), y desplegado a producción. **Inactivo a propósito** mientras dure la operación paralela con Cover — gateado por la variable `FISCALIZACION_TUSFACTURAS_ACTIVA`, que todavía no existe en Vercel.

### Próximo paso concreto
14/07/2026, en el local: Ariel activa la variable de entorno + redeploy, y hace una venta real con "Fiscalizar" tildado, siguiendo el resultado en vivo.

---

## 18. Sesión 13/07/2026 — Pipeline de fiscalización TusFacturasAPP construido y desplegado (inactivo)

### Contexto de arranque
Retomando desde el bloqueante de sesión anterior ("IP-INVALIDA"): se escribió y envió el mail a soporte de TusFacturasAPP, que respondió indicando usar el wildcard `*` en el campo de IP habilitada del punto de venta (opción pensada para plataformas serverless sin IP fija como Vercel). Ariel lo configuró desde el panel de TusFacturasAPP (Mi espacio de trabajo → Puntos de venta → editar → API), confirmado con captura: campo quedó en `*`. Bloqueante resuelto sin necesidad de proxy ni infraestructura extra.

### Verificaciones contra producción antes de escribir código (regla del proyecto respetada)
Antes de tocar código se corrieron `SELECT` para no asumir estructura:
- `comprobantes`: ya existía con la estructura completa (venta_id, tipo_comprobante_id, punto_venta_id, numero NOT NULL, comprobante_asociado_id, estado_fiscal_id NOT NULL, factura_cae, factura_cae_vencimiento, fecha_emision_utc, fiscalizacion_intentos, total, impreso_enviado).
- `clientes`: existe con cuit/dni/condicion_iva_id/domicilio/email — cliente id=1 = "Consumidor Final" (usado siempre hoy, ya que Ventas POS hardcodea `cliente_id: 1`).
- `tipos_comprobante`: id=1 "Factura" (genérico, sin distinción de letra A/B/C/M en la tabla — la letra la fija el código, no la BD, porque Ariel solo emite Factura C).
- `puntos_venta`: **gap real encontrado** — solo tenía el PV interno id=1 (número 0003, Cover) y el id=2 (0007, histórico inactivo). El PV 0004 nuevo no estaba cargado. Se insertó: `id=3, sucursal_id=1, numero=4, nombre='Sistema propio (Electrónico)', activo=true`.
- `estados_fiscales`: ya existía completa con los 6 estados necesarios (Pendiente/Enviado/CAE_Recibido/CAE_Rechazado/Reintentando/Anulado) — no hizo falta crear nada ahí.
- `numeracion_comprobantes`: estructura (punto_venta_id, tipo_comprobante_id, ultimo_numero) + función ya existente `obtener_proximo_numero_comprobante(p_punto_venta_id, p_tipo_comprobante_id)` (UPDATE...RETURNING atómico, mismo patrón que `incrementar_numero_venta`). Se preparó un INSERT con `WHERE NOT EXISTS` para la fila del PV 0004 (`punto_venta_id=3, tipo_comprobante_id=1, ultimo_numero=1` — arranca en 1 porque la factura de prueba real 00004-00000001 ya está emitida). Al ejecutarlo dio error de clave duplicada: **la fila ya existía** (cargada en algún momento anterior no registrado), confirmado con `SELECT * FROM numeracion_comprobantes` → `id=2, punto_venta_id=3, tipo_comprobante_id=1, ultimo_numero=1`. No hizo falta ninguna acción adicional, el script no rompió nada gracias al `WHERE NOT EXISTS`.

### Documentación oficial de TusFacturasAPP consultada (no se inventó ningún campo)
- Estructura completa del JSON de Factura C (`POST /app/api/v2/facturacion/nuevo`), incluyendo el detalle de que **AFIP/ARCA recibe solo totales para comprobantes A/B/C/M vía WSFEv1, nunca el detalle de ítems** — el array `detalle` del JSON es solo para gestión interna de TusFacturasAPP (PDF, reportes), no afecta la validez fiscal. Esto simplificó el mapeo: lo que tiene que ser exacto es `comprobante.total`, no la suma de la línea de detalle.
- Convención para "Consumidor Final sin especificar datos": `documento_tipo:"OTRO"`, `documento_nro:"0"` (aplica siempre hoy, ya que `cliente_id` está hardcodeado a 1 en el POS).
- Tabla oficial de códigos de provincia: **Río Negro = 16** (se había puesto un valor placeholder `99` en un primer borrador, corregido antes de entregar el archivo final — nunca llegó a desplegarse el valor incorrecto).
- Formato de respuesta exitosa: `{"error":"N","cae":"...","comprobante_nro":"00004-00000002","cae_vencimiento":"dd/mm/yyyy"}`. Formato de error: `{"error":"S","errores":[...],"error_details":[{"code":"...","text":"..."}]}`.

### Archivos nuevos — `src/lib/tusfacturas/`
- `tipos.ts` — tipos TypeScript del request/response de TusFacturasAPP.
- `mapeo.ts` — función `mapearVentaAFacturaC(venta, numeroComprobante)`: arma el JSON completo (cliente + comprobante + detalle) a partir de una venta del sistema. Exporta también `PUNTO_VENTA_ID=3` y `TIPO_COMPROBANTE_ID_FACTURA=1` para que `route.ts` no repita esos valores a mano. Resuelve cliente CUIT/DNI/Consumidor Final según los datos disponibles; código de provincia fijo en 16 (Río Negro).
- `emitir.ts` — llamado real a la API (`fetch` a `/app/api/v2/facturacion/nuevo`) + función `fiscalizacionActiva()`, que lee `process.env.FISCALIZACION_TUSFACTURAS_ACTIVA === 'true'`. Es el único punto del sistema donde se decide si se llama de verdad a TusFacturasAPP.

### Archivo modificado — `src/app/api/ventas/route.ts`
Reconstruido completo (no parcheado, se pidió y recibió el contenido actual primero). Agrega, después de generar el movimiento financiero de la venta, un bloque nuevo que solo se ejecuta si `fiscalizar === true` **y** `fiscalizacionActiva() === true`:
1. Reserva el próximo número de comprobante vía RPC `obtener_proximo_numero_comprobante`.
2. Inserta en `comprobantes` en estado Pendiente **antes** de llamar a la API — si el llamado falla, el número queda documentado como consumido y un futuro reintento reutilizaría el mismo comprobante en vez de pedir un número nuevo (evita huecos en la numeración fiscal real).
3. Trae cliente (`clientes` id=1) y datos de artículos (`articulos`, query separada — nunca join anidado, regla del proyecto) para completar el mapeo.
4. Llama a `mapearVentaAFacturaC` + `emitirFacturaC`.
5. Si la respuesta es exitosa: actualiza el comprobante a `estado_fiscal_id=3` (CAE_Recibido) con CAE y vencimiento reales, y actualiza `ventas.estado_venta_id=4` (Fiscalizada).
6. Si la respuesta es de error: actualiza el comprobante a `estado_fiscal_id=4` (CAE_Rechazado), deja `ventas.estado_venta_id` sin tocar (sigue en 1="Fiscal", pendiente de revisión manual), y loguea el detalle del error para seguimiento.
7. Cualquier excepción en este bloque completo **nunca revierte la venta** — la venta, sus items, pagos, stock y movimiento financiero ya quedaron confirmados antes de llegar a este punto; un fallo de fiscalización solo queda pendiente de revisión manual.

Mientras `FISCALIZACION_TUSFACTURAS_ACTIVA` no exista (o esté en `false`), este bloque completo no se ejecuta — el comportamiento es idéntico al que ya estaba en producción desde el 10/07 (venta se guarda igual, sin ningún llamado externo).

### SQL ejecutado en producción
- `supabase/numeracion_comprobantes_pv0004.sql` — corrido, no aplicó cambios (la fila ya existía, confirmado que es la correcta).
- Insert manual de la fila faltante en `puntos_venta` (PV 0004, id=3) — corrido y confirmado.

### Deploy
```powershell
cd "C:\Users\Usuario\Documents\sistema-habitus-sd"; git add -A; git commit -m "feat: integracion TusFacturasAPP (fiscalizacion gateada, inactiva por defecto)"; git push
```
Commit `6f08e9f`. Variables de entorno agregadas en Vercel (Production + Preview, todas Sensitive): `TUSFACTURAS_APIKEY`, `TUSFACTURAS_APITOKEN`, `TUSFACTURAS_USERTOKEN`. Redeploy manual confirmado exitoso ("Ready"). `FISCALIZACION_TUSFACTURAS_ACTIVA` deliberadamente sin crear.

### Pendiente para la próxima sesión
1. **14/07/2026, en el local:** Ariel activa `FISCALIZACION_TUSFACTURAS_ACTIVA=true` en Vercel + redeploy, hace una venta real con "Fiscalizar" tildado, seguimiento en vivo del resultado (CAE recibido / rechazado / error de red).
2. Actualizar `MAPA-ARCHIVOS.md` con los 4 archivos nuevos (`src/lib/tusfacturas/tipos.ts`, `mapeo.ts`, `emitir.ts`, y la reescritura de `api/ventas/route.ts`).
3. Revisar si la fecha objetivo de baja de Cover (12/07) sigue en pie, dado que recién ahora se activa la fiscalización real.
4. Diseñar el circuito de Nota de Crédito (Caso B) una vez validada la primera fiscalización real.
5. Replicar en sandbox todo lo acumulado, incluyendo esta integración completa (sigue desincronizado desde sesión 15).
