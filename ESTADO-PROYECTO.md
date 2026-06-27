# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 27/06/2026 — Sesión 11 (Dashboard + Puesta en producción)
**Estado general:** 🟢 Sistema desplegado en producción — operativo para arranque 01/07
**Próxima acción concreta:** Cargar datos de referencia en producción + artículos reales

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `supabase/01_referencia.sql` ✅ al `supabase/09_produccion_parches.sql` ✅ — todos ejecutados en producción

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
| Facturación AFIP | Facturama (MVP v2) |
| Pagos (MVP v2) | Mercado Pago (webhooks) |
| Tipografía sistema | Inter (Google Fonts) |
| Deploy | Vercel |
| Modo offline | No contemplado |

---

## 4. Módulos confirmados (orden de prioridad)

1. Artículos / Inventario ✅
2. Órdenes de Compra simplificadas ✅
3. Movimientos de Stock ✅
4. Ventas (carrito, modo POS, multi-pago) ✅
5. Movimientos financieros (ledger único) ✅
6. Caja ✅
7. Dashboard ✅
8. Reportes
9. Facturación AFIP automática (MVP v2)
10. Vitrina web propia (reemplaza Empretienda)
11. Team Habitus (sponsoreo a deportistas)

---

## 5. Infraestructura

- Organización Supabase: **Camino Doce Doce - IT** (plan Pro)
- **habitus-sd-sandbox** (sa-east-1) — desarrollo
- **habitus-sd-production** (sa-east-1, ref: `lfscdxrhwjpkkirxzhwt`) — producción ✅
- **sistema-turnos-lnt** — proyecto separado, activo
- Deploy: **Vercel** → https://sistema-habitus-sd.vercel.app ✅
- Usuarios producción creados: Ariel Vega (rol_id=1), Agustín Chandia (rol_id=2)

---

## 6. Plan de puesta en producción

| Fecha | Hito |
|---|---|
| 27/06 ✅ | Sistema desplegado en Vercel, login funcional |
| 28/06 | Cargar datos de referencia + artículos reales en producción |
| 29/06 | Prueba completa con Agustín |
| 01/07 | **Arranque paralelo** (Cover + sistema nuevo) |
| 06/07 | **Corte a sistema nuevo exclusivo** |
| 12/07 | Baja Cover |

---

## 7. Pendiente inmediato (antes del 01/07)

- [ ] Cargar rubros, marcas, tasas IVA, medios pago, proveedores en producción
- [ ] Cargar artículos reales (488 local / 130 con stock)
- [ ] Verificar todos los módulos contra producción
- [ ] Ajustar secuencias (ventas y comprobantes) al número real actual de Cover
- [ ] Configurar URL de Supabase en Authentication → URL Configuration (para recovery emails)

---

## 8. Decisiones pendientes

- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI
- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2.235 filas)
- [ ] Pantalla ABM Categorías/Conceptos de movimientos (post-MVP)
- [ ] Indicador rentabilidad caída en listado artículos
- [ ] Pantalla masiva actualización de precios
- [ ] MVP v2: modificar ventas Guardadas, Nota de Crédito, fiscalización ARCA vía Facturama
- [ ] MVP v2: Mercado Pago webhooks

---

## 9. Pantallas operativas

1. Dashboard ✅ (ventas día por turno, resumen mensual, estado caja, alertas stock)
2. Listado de artículos ✅
3. Formulario artículo — 5 solapas ✅
4. Listado movimientos financieros ✅
5. Formulario nuevo movimiento ✅
6. Listado órdenes de compra ✅
7. Nueva orden de compra ✅
8. Editar orden de compra ✅
9. Ventas POS ✅
10. Registro de ventas ✅
11. Movimientos de stock — listado ✅
12. Movimientos de stock — nuevo ✅
13. Movimientos de stock — edición ✅
14. Caja — apertura, cierre, retiro, reapertura ✅

---

## 10. Campos verificados en BD (referencia rápida)

- `tasas_iva`: campo es `nombre`, NO `descripcion`
- `movimientos`: `fecha_utc` (DATE), `cuenta_id` nullable, `anulado` BOOLEAN DEFAULT false
- `movimientos.mes_contable`: tipo DATE, formato YYYY-MM-01
- `ventas.fecha_utc`: tipo DATE; `cierre_turno_id` FK → cierres_turno
- `usuarios`: `nombre` + `apellido` separados (NO `nombre_completo`); `id` UUID
- `articulo_stock`: `stock_min`/`stock_max` (NO stock_minimo/stock_maximo)
- `ordenes_compra`: `flete_transportista_id` FK → transportistas; `flete_medio_pago_id` FK → medios_pago
- `proveedores`: campo `nombre_comercial`, NO `nombre`
- `categorias_gasto`: NO tiene campo `activo`; SÍ tiene campo `tipo`
- `conceptos_gasto`: NO tiene campo `tipo` en producción (solo id, categoria_gasto_id, nombre, creado_en)
- `cierres_turno`: `estado_cierre_turno_id` (1=Abierto, 2=Cerrado sin diferencia, 3=Cerrado con diferencia)
- `retiros_caja`: usa `cierre_turno_id` + `concepto` + `fecha_utc`
- `medios_pago`: Efectivo=1, Débito=2, Crédito=3, Transferencia=4
- `conceptos_gasto`: id=33 Compra mercadería, id=44 Flete compra

---

## 11. Sesión 11 — Dashboard + Puesta en producción

### Dashboard (nuevo módulo)
- Ventas del día con desglose Mañana/Tarde/Total (desde `ventas` + join `cierres_turno`)
- Estado de caja en tiempo real (calcula esperado sumando ventas efectivo + ingresos − egresos − retiros desde `creado_en` del turno)
- Resumen mensual (total ventas, cantidad, ticket promedio) + ingresos/egresos/diferencia desde `movimientos`
- Alertas stock mínimo (filtra en cliente: `stock_actual <= stock_min`)
- Botón "Abrir caja" cuando no hay turno / "Ver caja" cuando está abierto

### Correcciones aplicadas esta sesión
- **Bug editar compra**: `UPDATE movimientos SET anulado=true` movido fuera del `if (eraConfirmada)` — ahora siempre anula movimientos previos antes de insertar nuevos
- **Estado leído desde BD**: editar compra ahora hace SELECT fresco para determinar `eraConfirmada` (no usa estado React)
- **Caja y Movimientos**: agregado `.eq('anulado', false)` en queries de egresos/ingresos
- **Concepto flete**: `concepto_gasto_id=44` (Flete compra) en ambas rutas de compras (nueva y editar)
- **TypeScript fixes**: casts via `as unknown` en dashboard para joins de Supabase

### Producción
- Proyecto `habitus-sd-production` creado en Supabase (ref: `lfscdxrhwjpkkirxzhwt`)
- Schema completo ejecutado: 01 al 08 + fix_retiro + 09_produccion_parches
- Deploy en Vercel: https://sistema-habitus-sd.vercel.app
- Usuarios Ariel y Agustín creados en Auth + tabla `usuarios`
- Supabase Pro activo (soporta 3 proyectos)

### Próximos pasos
1. Cargar datos de referencia en producción (rubros, marcas, proveedores, etc.)
2. Cargar artículos reales
3. Prueba completa 30/06
4. Arranque paralelo 01/07

---

*Este archivo se actualiza al cierre de cada sesión. No re-relevar información ya confirmada.*
