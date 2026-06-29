# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 29/06/2026 — Sesión 14 (Arranque operativo con Agustín)
**Estado general:** 🟢 Sistema en uso real — Agustín cargando ventas del día
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
- GitHub: https://github.com/edarvega-OIL-IA/sistema-habitus-sd (conectado a Vercel) ✅
- Deploy workflow: `git add -A` → `git commit -m "..."` → `git push`
- Usuarios producción: Ariel Vega (Admin, fb5aab0b), Agustín Chandia (Encargado, ac8badd7)

---

## 6. Plan de puesta en producción

| Fecha | Hito |
|---|---|
| 27/06 ✅ | Sistema desplegado, datos cargados, módulos probados |
| 29/06 ✅ | **Arranque operativo** — Agustín cargando ventas reales |
| 30/06 | Conteo físico stock → UPDATE articulo_stock |
| 01/07 | **Arranque paralelo** confirmado (Cover + sistema nuevo) |
| 06/07 | **Corte a sistema nuevo exclusivo** |
| 12/07 | Baja Cover |

---

## 7. Pendiente inmediato

- [ ] Conteo físico stock 30/06 → subir Excel → UPDATE articulo_stock
- [ ] Borrar datos de prueba antes del arranque real (ventas test, movimientos test, cierres de prueba)
- [ ] 5 artículos aún sin código de barra (Energy Gel Mango, Protein Bar Pistacchio, Recovery Drink, 2 Shakers)
- [ ] Configurar URL de Supabase en Authentication → URL Configuration
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI

---

## 8. Decisiones pendientes

- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2.235 filas) — post-corte
- [ ] Filtro "precio = 0" en listado de artículos — 119 artículos sin precio
- [ ] Pantalla masiva actualización de precios
- [ ] Pantalla ABM Categorías/Conceptos de movimientos (post-MVP)
- [ ] MVP v2: modificar ventas Guardadas, Nota de Crédito, fiscalización ARCA vía Facturama
- [ ] MVP v2: Mercado Pago webhooks
- [ ] reabrir_ultimo_cierre: función no existe en producción todavía

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
10. Registro de ventas ✅
11. Movimientos de stock — listado ✅
12. Movimientos de stock — nuevo ✅
13. Movimientos de stock — edición ✅
14. Caja — apertura, cierre, retiro, reapertura ✅

---

## 10. Campos verificados en BD — producción (al 29/06/2026)

- `tasas_iva`: campo es `nombre`, NO `descripcion`; id 4=21%, 5=10.5%, 6=0%
- `movimientos`: `fecha_utc` DATE, `cuenta_id` nullable, `anulado` BOOLEAN DEFAULT false
- `movimientos.mes_contable`: tipo DATE, formato YYYY-MM-01
- `ventas`: `fecha_utc` DATE, `cierre_turno_id` FK → cierres_turno, `mes_contable` DATE
- `usuarios`: `nombre` + `apellido` separados; `id` UUID; tiene `email`
- `articulo_stock`: `stock_min`/`stock_max` (NO stock_minimo/stock_maximo)
- `ordenes_compra`: `flete_transportista_id` FK → transportistas; `flete_medio_pago_id` FK → medios_pago
- `proveedores`: campo `nombre_comercial`, NO `nombre`
- `categorias_gasto`: tiene campo `tipo` (Ingreso/Egreso/Ambos/Sistema); NO tiene campo `activo`
- `conceptos_gasto`: tiene campo `tipo` (igual que sandbox)
- `cierres_turno`: `estado_cierre_turno_id` (1=Abierto, 2=Sin diferencia, 3=Con diferencia)
- `retiros_caja`: `cierre_turno_id` + `concepto` + `fecha_utc` + `sucursal_id`
- `medios_pago`: Efectivo=1, Débito=2, Crédito=3, Transferencia=4
- `articulos`: tiene `unidad_medida_id`, `id_migracion`; `marca_id` y `rubro_id` nullable
- `turnos`: 1=Mañana, 2=Tarde (NO existe id=3)
- `movimientos_stock`: `articulo_id`, `cantidad`, `estado_movimiento_stock_id` nullable (columnas legacy)
- `deportistas`: tiene `deporte_id` FK → deportes

---

## 11. Datos en producción (al 29/06/2026)

- medios_pago: 4 | tasas_iva: 3 | unidades_medida: 3
- rubros: 21 (ids 1-19, 22, 23) | marcas: 39 (ids 1-16, 18, 20-41)
- emisores_pago: 9 | proveedores: 4 | transportistas: 3 | depositos: 1
- categorias_gasto: 12 | conceptos_gasto: 31
- subtipos_movimiento_stock: 3 | deportes: 6 | deportistas: 8
- articulos: 486 (120 disponibles local, 119 sin precio, 127 con stock)
- Secuencias: ventas=1310, comprobantes=386
- 26 artículos actualizados con código de barra (sesión 14)
- 5 artículos aún sin código de barra

---

## 12. Archivos SQL

| Archivo | Estado |
|---|---|
| `supabase/HABITUS_SD_PRODUCCION_COMPLETO.sql` | ✅ Script único — reemplaza todos los anteriores |
| `supabase/12_produccion_datos_referencia.sql` | ✅ Datos referencia (idempotente) |
| `supabase/13_produccion_articulos.sql` | ✅ 486 artículos + stock inicial |
| `supabase/14_produccion_stock_inicial.sql` | Template para conteo físico 30/06 |
| `supabase/15_produccion_esquema_datos_adicionales.sql` | ✅ Deportes, deportistas, correcciones |
| Archivos 01-11 | Historial — NO usar para nuevas instalaciones |

---

## 13. Sesión 14 — Arranque operativo

### Correcciones aplicadas en producción
- `incrementar_numero_venta(p_sucursal_id)`: función creada — el código la llama así pero el script consolidado la había nombrado `obtener_proximo_numero_venta`. Registrado en `HABITUS_SD_PRODUCCION_COMPLETO.sql`
- `numeracion_ventas`: actualizado a 1310 (último número real de Cover)

### Correcciones de código
- `PanelPagos.tsx`: botones Fiscalizar/Guardar usan clases React (`btnVerde`/`btnBlanco`/`btnDis`) en lugar de `:focus` CSS — el color ya no depende del foco del DOM sino del estado `debeFiscalizar` y `puedeConfirmar`
- `kbd` dentro de botones: usa `bg-white/25` cuando botón está verde

### Artículos sin código de barra
- 31 artículos con stock identificados sin código
- 26 actualizados con códigos reales escaneados
- 5 pendientes: Energy Gel Mango, Protein Bar Pistacchio Crunch, Recovery Drink Naranja, 2 Shakers Gentech

### Errores nuevos aprendidos
10. **Nombres de funciones deben ser consistentes entre sandbox y producción** — el código llama `incrementar_numero_venta` pero el script la creó como `obtener_proximo_numero_venta`. Siempre verificar que el nombre en el SQL coincide con el que usa el código.

---

*Este archivo se actualiza al cierre de cada sesión. No re-relevar información ya confirmada.*
