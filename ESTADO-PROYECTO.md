# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 29/06/2026 — Sesión 14 (Arranque operativo real)
**Estado general:** 🟢 Sistema en uso real — primera jornada completa operativa
**Próxima acción concreta:** Conteo físico stock 30/06 → UPDATE articulo_stock

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `supabase/HABITUS_SD_PRODUCCION_COMPLETO.sql` — script único de instalación desde cero

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
| Deploy | Vercel (conectado a GitHub, deploy automático en push) |
| Repositorio | GitHub: edarvega-OIL-IA/sistema-habitus-sd (privado, rama master) |
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
- Deploy: **Vercel** → https://sistema-habitus-sd.vercel.app ✅
- GitHub: https://github.com/edarvega-OIL-IA/sistema-habitus-sd (privado, rama master) ✅
- Deploy workflow: `git add -A` → `git commit -m "..."` → `git push`
- Usuarios producción: Ariel Vega (Admin, fb5aab0b), Agustín Chandia (Encargado, ac8badd7)

---

## 6. Plan de puesta en producción

| Fecha | Hito |
|---|---|
| 27/06 ✅ | Sistema desplegado, datos cargados |
| 29/06 ✅ | **Primera jornada operativa completa** — 9 ventas registradas |
| 30/06 | Conteo físico stock → UPDATE articulo_stock |
| 01/07 | **Arranque paralelo** (Cover + sistema nuevo) |
| 06/07 | **Corte a sistema nuevo exclusivo** |
| 12/07 | Baja Cover |

---

## 7. Pendiente inmediato

- [ ] Conteo físico stock 30/06 → subir Excel → UPDATE articulo_stock
- [ ] Borrar datos de prueba antes del arranque real (cierres turno prueba, movimientos prueba)
- [ ] 5 artículos aún sin código de barra (Energy Gel Mango, Protein Bar Pistacchio, Recovery Drink, 2 Shakers)
- [ ] Configurar URL de Supabase en Authentication → URL Configuration
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI
- [ ] Agregar `estados_venta` id=4 "Fiscalizada" al script consolidado

---

## 8. Decisiones pendientes

- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2.235 filas) — post-corte
- [ ] Filtro "precio = 0" en listado de artículos — 119 artículos sin precio
- [ ] Pantalla masiva actualización de precios
- [ ] Pantalla ABM Categorías/Conceptos de movimientos (post-MVP)
- [ ] MVP v2: modificar ventas Guardadas, Nota de Crédito, fiscalización ARCA vía Facturama
- [ ] MVP v2: Mercado Pago webhooks
- [ ] reabrir_ultimo_cierre: función no existe en producción todavía
- [ ] Numeración comprobantes: ajustar al último número real de Cover el día del corte (06/07)

---

## 9. Pantallas operativas

1. Dashboard ✅
2. Listado de artículos ✅
3. Formulario artículo — 5 solapas ✅
4. Listado movimientos financieros ✅
5. Formulario nuevo movimiento ✅
6. Listado órdenes de compra ✅
7. Nueva orden de compra ✅
8. Editar orden de compra ✅
9. Ventas POS ✅
10. Registro de ventas ✅ (con estado Fiscalizada)
11. Movimientos de stock — listado ✅
12. Movimientos de stock — nuevo ✅
13. Movimientos de stock — edición ✅
14. Caja — apertura, cierre, retiro, reapertura ✅

---

## 10. Campos verificados en BD — producción (29/06/2026)

**Fuente de verdad:** SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ejecutado en producción el 29/06/2026.

- `ventas`: fecha_utc DATE, cierre_turno_id BIGINT, mes_contable DATE — NO tiene recargo_pct en sandbox pero SÍ en producción
- `venta_pagos`: tiene emisor_pago_id, payment_method_raw (agregados 29/06)
- `movimientos`: fecha_utc DATE, cuenta_id nullable, anulado BOOLEAN
- `movimientos_stock`: fecha_utc TIMESTAMPTZ en prod (DATE en sandbox) — pendiente corregir
- `retiros_caja`: fecha_utc TIMESTAMPTZ en prod (DATE en sandbox) — pendiente corregir
- `cierres_turno`: tiene cerrado_en TIMESTAMPTZ
- `usuarios`: nombre + apellido separados, tiene email
- `articulos`: tiene id_migracion, unidad_medida_id; marca_id y rubro_id nullable
- `deportistas`: tiene deporte (texto legacy) + deporte_id FK
- `reaperturas_caja`: en prod tiene snapshot_antes/despues JSONB; en sandbox tiene campos numéricos distintos
- `subtipos_movimiento_stock`: en sandbox tiene creado_en, en prod no
- `medios_pago`: Efectivo=1, Débito=2, Crédito=3, Transferencia=4, QR Mercado Pago=5 (agregado 29/06)
- `estados_venta`: 1=Pendiente fiscal, 2=Guardada, 3=Anulada, 4=Fiscalizada (agregado 29/06)
- `emisores_pago`: Mercado Pago=7

---

## 11. Datos en producción (al 29/06/2026)

- medios_pago: 5 (agregado QR Mercado Pago=5)
- estados_venta: 4 (agregado Fiscalizada=4)
- articulos: 486 | Secuencias: ventas=1320, comprobantes=386
- 26 artículos con código de barra actualizado; 5 pendientes
- Ventas del día 29/06: 9 válidas + 1 anulada = $278.150 total

---

## 12. Archivos SQL

| Archivo | Estado |
|---|---|
| `supabase/HABITUS_SD_PRODUCCION_COMPLETO.sql` | ⚠️ Desactualizado — falta QR MP, Fiscalizada, funciones corregidas |
| `supabase/12_produccion_datos_referencia.sql` | ✅ Datos referencia |
| `supabase/13_produccion_articulos.sql` | ✅ 486 artículos |
| `supabase/14_produccion_stock_inicial.sql` | Template conteo físico 30/06 |
| `supabase/15_produccion_esquema_datos_adicionales.sql` | ✅ |

---

## 13. Sesión 14 — Arranque operativo 29/06/2026

### Correcciones aplicadas en producción (SQL)
- `incrementar_numero_venta(p_sucursal_id BIGINT)`: creada con WHERE id=1 en el UPDATE
- `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated`
- `venta_pagos.emisor_pago_id` y `payment_method_raw`: columnas agregadas (faltaban en prod)
- `ventas.fecha_utc`: TYPE DATE (era TIMESTAMPTZ)
- `get_rol_usuario()`, `eliminar_movimiento_stock()`, `editar_movimiento_stock()`: creadas en producción
- `medios_pago`: agregado id=5 "QR Mercado Pago" (fiscaliza_por_defecto=true)
- `estados_venta`: agregado id=4 "Fiscalizada"
- `numeracion_ventas`: actualizado a 1310 al inicio, secuencia llegó a 1320 al cierre

### Correcciones de código
- `PanelPagos.tsx`: botones usan clases React (btnVerde/btnBlanco/btnDis) en lugar de CSS :focus
- `ventas/registro/page.tsx`: filtro y display de fecha usa substring(0,10); chip "Fiscalizada" agregado
- `cierre-turno/page.tsx`: hora de ventas usa creado_en en lugar de fecha_utc
- `ArticuloForm.tsx`: precio_local usa ?? 0 en lugar de || null

### Datos corregidos manualmente (SQL directo)
- Ventas #1313, #1316, #1317, #1318, #1319, #1320: medio_pago actualizado a QR MP o corregido
- Ventas fiscalizadas en Cover marcadas como estado_venta_id=4
- Movimiento de flete de prueba eliminado (id=10)

### Errores aprendidos sesión 14
10. Nombres de funciones deben coincidir SQL↔código — `incrementar_numero_venta` vs `obtener_proximo_numero_venta`
11. CSS :focus no confiable en tablets — usar clases React por estado
12. Sandbox y producción divergieron silenciosamente — la única fuente de verdad es un SELECT en producción, no los SQLs ni la documentación
13. `GRANT USAGE, SELECT ON ALL SEQUENCES` debe ejecutarse en producción — no asumir que los GRANTs de sandbox aplican
14. Schema cache de Supabase puede quedar desactualizado — usar `SELECT pg_notify('pgrst', 'reload schema')` después de ALTER TABLE

---

*Este archivo se actualiza al cierre de cada sesión. No re-relevar información ya confirmada.*
