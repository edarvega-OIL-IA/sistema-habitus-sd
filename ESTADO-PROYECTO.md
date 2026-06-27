# ESTADO-PROYECTO — Sistema Habitus SD

**Última actualización:** 27/06/2026 — Sesión 12 (Correcciones producción + GitHub)
**Estado general:** 🟢 Sistema operativo en producción — todos los módulos funcionales
**Próxima acción concreta:** Cargar datos de referencia en producción + artículos reales

---

## 1. Qué es este archivo

Punto de entrada para retomar el proyecto en cualquier sesión nueva. Se actualiza al cierre de cada sesión (lección LNT #5).

Documentos relacionados:
- `HABITUS_SD_ANALISIS_SESION01.md` — análisis funcional completo (41 secciones)
- `HABITUS_UI_REGLAS.md` — reglas de UI confirmadas
- `CLAUDE_CODE_PROMPT.md` — contexto para Claude Code (campos BD verificados, rutas, reglas)
- `supabase/01_referencia.sql` ✅ al `supabase/11_produccion_rls_completo.sql` ✅

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
- **sistema-turnos-lnt** — proyecto separado, activo
- Deploy: **Vercel** → https://sistema-habitus-sd.vercel.app ✅
- GitHub: https://github.com/edarvega-OIL-IA/sistema-habitus-sd (conectado a Vercel) ✅
- Deploy workflow: `git add -A` → `git commit -m "..."` → `git push` → Vercel deploya automático
- Usuarios producción: Ariel Vega (Admin, fb5aab0b), Agustín Chandia (Encargado, ac8badd7)

---

## 6. Plan de puesta en producción

| Fecha | Hito |
|---|---|
| 27/06 ✅ | Sistema desplegado en Vercel, todos los módulos funcionales |
| 28/06 | Cargar datos de referencia + artículos reales en producción |
| 29/06 | Prueba completa con Agustín |
| 01/07 | **Arranque paralelo** (Cover + sistema nuevo) |
| 06/07 | **Corte a sistema nuevo exclusivo** |
| 12/07 | Baja Cover |

---

## 7. Pendiente inmediato (antes del 01/07)

- [ ] Cargar rubros, marcas, tasas IVA, medios pago, proveedores en producción
- [ ] Cargar artículos reales (488 local / 130 con stock)
- [ ] Verificar módulos Ventas y Stock contra producción
- [ ] Ajustar secuencias (ventas y comprobantes) al número real actual de Cover
- [ ] Configurar URL de Supabase en Authentication → URL Configuration (para recovery emails)
- [ ] Reemplazar `alert()` en confirmación de venta POS por notificación UI

---

## 8. Decisiones pendientes

- [ ] Migrar datos históricos MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (2.235 filas)
- [ ] Pantalla ABM Categorías/Conceptos de movimientos (post-MVP)
- [ ] Indicador rentabilidad caída en listado artículos
- [ ] Pantalla masiva actualización de precios
- [ ] MVP v2: modificar ventas Guardadas, Nota de Crédito, fiscalización ARCA vía Facturama
- [ ] MVP v2: Mercado Pago webhooks

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

## 10. Campos verificados en BD — producción y sandbox

- `tasas_iva`: campo es `nombre`, NO `descripcion`
- `movimientos`: `fecha_utc` (DATE), `cuenta_id` nullable, `anulado` BOOLEAN DEFAULT false
- `movimientos.mes_contable`: tipo DATE, formato YYYY-MM-01
- `ventas`: `fecha_utc` DATE, `cierre_turno_id` FK → cierres_turno, `mes_contable` DATE
- `usuarios`: `nombre` + `apellido` separados (NO `nombre_completo`); `id` UUID; tiene `email`
- `articulo_stock`: `stock_min`/`stock_max` (NO stock_minimo/stock_maximo)
- `ordenes_compra`: `flete_transportista_id` FK → transportistas; `flete_medio_pago_id` FK → medios_pago
- `proveedores`: campo `nombre_comercial`, NO `nombre`
- `categorias_gasto`: NO tiene campo `activo`; SÍ tiene campo `tipo`
- `conceptos_gasto`: en producción NO tiene columna `tipo` (solo id, categoria_gasto_id, nombre, creado_en)
- `cierres_turno`: `estado_cierre_turno_id` (1=Abierto, 2=Cerrado sin diferencia, 3=Cerrado con diferencia); tiene `apertura_contada`, `diferencia_apertura`, `cerrado_en`, `cantidad_reaperturas`
- `retiros_caja`: usa `cierre_turno_id` + `concepto` + `fecha_utc` + `sucursal_id`
- `medios_pago`: Efectivo=1, Débito=2, Crédito=3, Transferencia=4
- `conceptos_gasto`: id=33 Compra mercadería, id=44 Flete compra
- `articulos`: tiene `unidad_medida_id` (agregado en producción sesión 12)
- `turnos`: 1=Mañana, 2=Tarde (General id=3 eliminado de producción)

---

## 11. Sesión 12 — Correcciones producción + GitHub

### Problema raíz identificado
El esquema de producción se creó con SQLs 01-08 + parches básicos, pero faltaban:
- Columnas agregadas durante sesiones 9-11 en sandbox
- Políticas RLS en la mayoría de tablas
- GRANTs de ejecución a rol `authenticated`
La causa: cada cambio en sandbox debía haberse registrado en un SQL de producción al momento de hacerlo. No se hizo.

### Archivos SQL generados esta sesión
- `supabase/10_produccion_fix_esquema.sql` — columnas faltantes + RLS artículos
- `supabase/11_produccion_rls_completo.sql` — tablas faltantes + RLS completo todas las tablas + GRANTs

### Columnas agregadas en producción
- `movimientos.anulado` BOOLEAN DEFAULT false
- `ordenes_compra.flete_transportista_id` BIGINT FK → transportistas
- `articulos.unidad_medida_id` BIGINT FK → unidades_medida
- `cierres_turno.apertura_contada` NUMERIC(12,2)
- `cierres_turno.diferencia_apertura` NUMERIC(12,2)
- `cierres_turno.cerrado_en` TIMESTAMPTZ
- `cierres_turno.cantidad_reaperturas` INTEGER DEFAULT 0
- `usuarios.email` TEXT
- `retiros_caja.sucursal_id` BIGINT FK → sucursales
- `ventas.cierre_turno_id` BIGINT FK → cierres_turno
- `ventas.fecha_utc` DATE
- `ventas.mes_contable` DATE
- `movimientos_stock.subtipo_movimiento_stock_id` BIGINT FK → subtipos_movimiento_stock
- `movimientos_stock.deportista_id` BIGINT FK → deportistas

### Tablas creadas en producción (faltaban del 09_produccion_parches)
- `subtipos_movimiento_stock`
- `historico_precios`
- `reaperturas_caja`
- `movimiento_stock_items`

### Función corregida
- `abrir_turno`: `v_apertura := COALESCE(v_apertura, 0)` agregado después del SELECT INTO — PostgreSQL pisa el valor inicial con NULL cuando no hay filas; el COALESCE en la declaración no alcanza.

### Datos corregidos en producción
- `turnos`: eliminado id=3 (General) — solo Mañana y Tarde

### RLS + GRANTs aplicados
- Todas las tablas tienen RLS habilitado y políticas SELECT/INSERT/UPDATE/DELETE según corresponde
- `GRANT` ejecutado para rol `authenticated` en todas las tablas operativas
- `GRANT EXECUTE` en funciones: `abrir_turno`, `cerrar_turno`, `registrar_retiro_caja`, `get_rol_usuario`, `eliminar_movimiento_stock`

### GitHub configurado
- Repositorio: https://github.com/edarvega-OIL-IA/sistema-habitus-sd (privado)
- Conectado a Vercel — deploy automático en cada push a `master`
- Workflow: `git add -A` → `git commit -m "..."` → `git push`

### Correcciones de código
- `dashboard/page.tsx`: eliminados joins anidados en `cargarCaja` y `cargarVentasDia` — reemplazados por queries separadas + merge (patrón RLS)

### Errores a NO repetir
1. **Nunca usar joins anidados en Supabase** — RLS los bloquea silenciosamente. Siempre query separada + merge por Map
2. **Todo cambio de esquema en sandbox debe registrarse inmediatamente en un SQL de producción** — no esperar al deploy
3. **RLS + GRANT van juntos** — habilitar RLS sin GRANT o sin políticas bloquea todo
4. **`SELECT INTO` en PL/pgSQL pisa el valor inicial** — siempre usar `COALESCE(variable, fallback)` después del SELECT INTO
5. **Deploy con `npx vercel deploy --prod` no garantiza variables de entorno** — usar GitHub + deploy automático de Vercel
6. **`&&` no funciona en PowerShell** — usar `;` como separador de comandos

---

*Este archivo se actualiza al cierre de cada sesión. No re-relevar información ya confirmada.*
