# MAPA-ARCHIVOS — Sistema Habitus SD

**Propósito:** índice rápido de "qué archivo modifico para tocar tal cosa",
para no perder tiempo buscando/adivinando la ruta. No reemplaza a
`ESTADO-PROYECTO.md` (que documenta el estado y las decisiones) ni a
`CLAUDE_CODE_PROMPT.md` (contexto técnico de columnas de BD) — es solo un
mapa de ubicación de archivos.

**Cómo se mantiene:** se actualiza al cierre de cada sesión, agregando
cualquier archivo nuevo y corrigiendo la descripción de los que se
modificaron. Los marcados con `[?]` no están confirmados con certeza —
completar o corregir la próxima vez que se toquen.

---

## Páginas — `src/app/(sistema)/` (rutas protegidas, requieren login)

| Ruta | Qué hace |
|---|---|
| `dashboard/page.tsx` | Dashboard principal. Rediseñado completo el 17/07 (banner de turno → Ventas del día → tarjetas del mes → Punto de Equilibrio → Clima del negocio → Stock Valorizado colapsable → Artículos en stock mínimo colapsable). Responsive mobile arreglado el 22/07 (breakpoint único `md:grid-cols-5`). |
| `caja` → `cierre-turno/page.tsx` | Pantalla **Caja**: apertura, cierre, retiro y reapertura de turno con auditoría. Tabla "Historial de cajas" (últimas 30, agregada 22/07) — **falta** filtros (fecha/turno/responsable/estado), pendiente. |
| `ventas/page.tsx` | **Ventas POS**: carrito, multi-pago, bloqueada sin caja abierta. Usa `BuscadorProductos.tsx`, `CarritoItems.tsx` (columna Precio Unit. agregada 17/07), `PanelPagos.tsx`. Checkbox Fiscalizar dispara `fiscalizarVenta()` (ver `lib/tusfacturas/fiscalizar.ts`). |
| `ventas/registro/page.tsx` | **Registro de Ventas**: filtros período/turno/medio/estado (incluye `estado_venta_id=5` "Fiscalizado externamente"), `anularVenta` (solo para "Guardada"), botón Editar abre `EditarItemsVentaModal.tsx`. |
| `fiscalizacion/page.tsx` | **Nuevo (27/07).** Reintento manual de fiscalización — lista ventas Guardadas sin fiscalizar o Rechazadas (`estado_venta_id` 1 o 2), con selector de Cliente y Contado/Cuenta corriente (si el cliente elegido tiene cta cte). Filtros **Rechazadas/Error \| Sin fiscalizar \| Todas** (ese orden, default en Rechazadas/Error). Muestra `comprobantes.mensaje_error` del último intento. Llama a `api/fiscalizacion/route.ts` (gate rol Admin adentro del endpoint, no en la página). |
| `movimientos/page.tsx` | Listado de movimientos (ledger). Filtros Día/Mes/Año/Libre/Todos, checkbox "Excluir movimientos internos de Caja", filtro por Medio de Pago (17/07). |
| `movimientos/nuevo/page.tsx` | Alta de movimiento financiero manual (usa `MovimientoForm.tsx`). |
| `movimientos/[id]/page.tsx` | Edición de movimiento. Gate: Admin siempre puede, otro usuario solo si `cierre_turno_id` = cierre activo; solo movimientos manuales (`origen_tipo IS NULL`). |
| `obligaciones/page.tsx` | **Nuevo (29/07).** Cuenta corriente por acreedor (impuestos, sueldos, servicios, profesionales). Categorías como tarjetas colapsables (cerradas por default; tocar una puntual la auto-abre; "Todas" fuerza cierre de todas). Cada acreedor expandible con detalle Cargo/Pago/Saldo corrido (calculado al vuelo). Modales "+ Nuevo cargo" (no toca `movimientos`) y "+ Registrar pago" total/parcial (genera el Egreso real y lo enlaza vía `movimiento_id`). Conceptos disponibles por acreedor filtrados por la tabla puente `acreedor_conceptos`, no por categoría. |
| `articulos/page.tsx` | Listado de artículos. Filtros Disponibilidad, Stock (incluye "Con mínimo"/"Bajo mínimo", 17/07), combo Marca dependiente del Rubro elegido. Botón **"Generar glosa"** (25/07, junto a "+ Nuevo artículo") — habilitado solo con ≥1 filtro real (Rubro/Marca/Búsqueda), arma texto WhatsApp/IG agrupado por `nombre_base`+Marca con sabores en stock, formato `- *Marca* - Producto - Sabor1, Sabor2 *$ Precio*`. Botón "Actualizar precios" (Admin) → `articulos/precios/page.tsx`. Ícono "Duplicar" (22/07) → `/articulos/nuevo?duplicar=<id>`. |
| `articulos/nuevo/page.tsx` | Alta de artículo (usa `ArticuloForm.tsx`). |
| `articulos/[id]/page.tsx` | Edición de artículo (mismo formulario compartido). |
| `articulos/precios/page.tsx` | Actualización de precios unificada. Filtros iguales a Artículos + "OC pendiente" + "Solo desactualizados". Ajuste masivo por % con preview. Admin-only. |
| `articulos/historial/page.tsx` | **Nuevo (22/07).** Cuenta corriente de stock por artículo — Stock Calculado (historial completo) vs. Stock real (`articulo_stock`), fila naranja si no coinciden. Filtros Rubro/Marca/Nombre/rango de fechas/"Solo con diferencia". Solo artículos `disponible_local=true`. |
| `compras/page.tsx` | Listado de Órdenes de Compra. Detalle expandible con ítems, columnas Compra/Flete/Total, fila ámbar para ítems de ajuste por redondeo. |
| `compras/nueva/page.tsx` | Alta de nueva Orden de Compra. Genera movimiento de mercadería/flete al guardar (Borrador o Confirmada). **Fix 28/07:** `descuento_pct` de cada ítem faltaba en el `INSERT` — ya corregido. |
| `compras/[id]/page.tsx` | Edición de Orden de Compra. `sincronizarMovimiento()` mantiene una sola fila de movimiento por orden+subtipo (ver `CLAUDE_CODE_PROMPT.md`, sección Compras). Avisos de diferencia se auto-limpian al editar (17/07). **Fix 28/07:** `descuento_pct` faltaba en el `SELECT` de carga y el `INSERT` de guardado — ya corregido. |
| `compras/[id]/page_compras_id_old.tsx` | `[?]` Backup viejo, candidato a borrar — pendiente confirmar. |
| `stock/page.tsx` | Movimientos de stock manuales + automáticos con checkbox "Excluir venta/compra" (incluye Saldo inicial, 22/07). Traba Editar/Eliminar para Saldo inicial. |
| `stock/nuevo/page.tsx` | Alta de movimiento de stock manual (usa `MovimientoStockForm.tsx`). |
| `stock/[id]/page.tsx` | Edición de movimiento de stock manual. |
| `reportes/page.tsx` | `[?]` Módulo Reportes — pendiente de desarrollo. |
| `configuracion/page.tsx` | `[?]` Configuración general — sin detalle reciente registrado. |
| `diagnostico/page.tsx` | Herramienta temporal (scanner de código de barras, sesión 16). **Pendiente borrar.** |
| `layout.tsx` (dentro de `(sistema)/`) | Layout compartido — incluye `Sidebar.tsx` y `Header.tsx`. |

## API routes — `src/app/api/`

| Ruta | Qué hace |
|---|---|
| `api/ventas/route.ts` | Confirma una venta desde el POS: inserta `ventas`/`venta_items`/`venta_pagos`, movimiento financiero (una fila por medio de pago, fix 17/07) y movimiento de stock. **Simplificado 27/07**: la fiscalización ya no vive acá — llama a `fiscalizarVenta()` de `lib/tusfacturas/fiscalizar.ts`. |
| `api/fiscalizacion/route.ts` | **Nuevo (27/07).** Endpoint que usa la pantalla `/fiscalizacion` para reintentar/fiscalizar manualmente. Gate rol Admin (`rol_id !== 1` → 403). Llama a la misma `fiscalizarVenta()` que el POS automático. |

## Resto de `src/app/`

| Ruta | Qué hace |
|---|---|
| `login/page.tsx` | Pantalla de login. |
| `layout.tsx` (raíz) | Layout raíz — fuentes (Inter), metadata global. |
| `page.tsx` (raíz) | `[?]` Probablemente redirección a `/login` o `/dashboard` según sesión. |

## Componentes — `src/components/`

| Ruta | Qué hace |
|---|---|
| `articulos/ArticuloForm.tsx` | Formulario compartido de artículo, 5 solapas. **Rediseño 25/07**: Sabor (select) + Nombre comercial del sabor movidos a Identificación; Nombre de solo lectura, autogenerado (mismo cálculo que el trigger `fn_generar_nombre_articulo`) cuando hay `nombre_base` cargado; elegir Sabor autocompleta Nombre comercial. Duplicar copia `nombre_base` y exige Sabor distinto al origen (fix de gap real, 25/07). GAP PENDIENTE: no oculta costos para Encargado (rol_id=2). |
| `layout/Header.tsx` | Encabezado del sistema. |
| `layout/Sidebar.tsx` | Menú lateral, drawer en mobile (22/07). Orden actual: Dashboard, Caja, Ventas, Registro Ventas, **Fiscalización** (27/07), Movimientos, **Obligaciones** (29/07), Artículos (grupo con submenú: Administrar/Precios/Historial/Movimientos de Stock), Compras, Reportes, Configuración. |
| `movimientos/MovimientoForm.tsx` | Formulario compartido de movimiento (alta y edición). **29/07:** campo "Período" (mes, separado de Fecha — solo referencia, NO alimenta `mes_contable`) y "Fecha de vencimiento" (opcional); ambos ocultos si Categoría="Caja". Bloqueo real (+ aviso en vivo) de guardar en Efectivo sin turno abierto. |
| `stock/MovimientoStockForm.tsx` | Formulario compartido de movimiento de stock manual. |
| `ui/button.tsx` | Componente genérico de botón (shadcn/ui). |
| `ventas/BuscadorProductos.tsx` | Buscador de artículos en Ventas POS. Catálogo en memoria, búsqueda tokenizada, blindaje anti-rebote de scanner, scroll fix con flechas (13/07). |
| `ventas/CarritoItems.tsx` | Carrito de Ventas POS. Columna "Precio Unit." (17/07). |
| `ventas/EditarItemsVentaModal.tsx` | Modal "Editar ítems" (Caso A) — ediciones en ventas Guardadas, delta de stock, auditoría, diferencia de cobro. |
| `ventas/PanelPagos.tsx` | Panel de medios de pago multi-pago. Ancho ampliado, "Restan pagar" prominente, edición de pagos ya cargados (17/07). |

## `src/lib/`

| Ruta | Qué hace |
|---|---|
| `lib/supabase/client.ts` | Cliente Supabase para el navegador. |
| `lib/supabase/server.ts` | Cliente Supabase para el servidor. |
| `lib/utils.ts` | `[?]` Probablemente `cn()` de shadcn/ui. |
| `lib/tusfacturas/tipos.ts` | Tipos TS del request/response de TusFacturasAPP. **27/07:** `condicion_iva` pasó de `'CF'` fijo a `TusFacturasCondicionIva` (`'CF'\|'RI'\|'M'\|'E'`). |
| `lib/tusfacturas/mapeo.ts` | `mapearVentaAFacturaC(venta, numeroComprobante, opciones)`. **27/07, cambio grande:** ya no asume Consumidor Final — resuelve condición de IVA real (tabla `condiciones_iva`) y condición de pago real (Contado=`201`, o según días de plazo de cta. cte. — 5→`213`, 10→`206`, 15→`207`, 20→`209`, 30→`202`, 45→`208`, 60→`203`, 90→`204`, genérico=`205`), con vencimiento calculado según corresponda. `ClienteParaFacturar` ahora recibe el registro completo del cliente (id, condición IVA, cta cte), no solo cuit/dni/nombre. |
| `lib/tusfacturas/emitir.ts` | Llamado real a la API + `fiscalizacionActiva()`. Sin cambios en esta sesión. |
| `lib/tusfacturas/fiscalizar.ts` | **Nuevo (27/07).** `fiscalizarVenta(ventaId, clienteId, esContado)` — pipeline único usado tanto por `api/ventas/route.ts` (automático, cliente_id=1 fijo, siempre contado) como por `api/fiscalizacion/route.ts` (manual, cliente y forma de pago elegidos). Si ya existe un `comprobante` para la venta (reintento), reutiliza el mismo número reservado. Guarda el motivo real de rechazo en `comprobantes.mensaje_error`. |

## Raíz de `src/`

| Ruta | Qué hace |
|---|---|
| `proxy.ts` | Middleware de autenticación — reemplaza a `middleware.ts` (Next.js 16). |

---

## Notas operativas relevantes (no son archivos, pero afectan cómo se usan)

- **`FISCALIZACION_TUSFACTURAS_ACTIVA=true` está ACTIVO en Vercel desde el 14/07/2026** — cualquier venta con "Fiscalizar" tildado genera una factura C real ante ARCA sin intervención manual.
- **Incidente real 27/07:** un deploy rompió la fiscalización automática unas horas por falta de GRANT en 3 tablas viejas (`condiciones_iva`, `localidades`, `tipos_cliente`) — resuelto el mismo día, ver `ESTADO-PROYECTO.md` sección 23, Bloque 3.
- **Circuito de Nota de Crédito no existe todavía** — gap de esquema `comprobantes.venta_id UNIQUE` sigue bloqueando guardar una NC real en `comprobantes`.
- **`Obligaciones` es independiente de `movimientos.estado_cobro_id`** — esa columna existe en `movimientos` pero está sin usar (verificado 30/07); el modelo de deuda es la tabla `obligaciones` nueva, no confundir los dos.

---

*Última actualización: 30/07/2026 — sesión 23 (27-29/07): pantalla Fiscalización + pipeline `fiscalizar.ts` + fix `mapeo.ts`/`tipos.ts` (condición IVA/pago reales), pantalla Obligaciones completa, fix `descuento_pct` en Compras, cambios en `MovimientoForm.tsx` (Período/Vencimiento/bloqueo Efectivo), `Sidebar.tsx` actualizado. También se puso al día todo lo de sesiones 21/07-25/07 que había quedado pendiente de volcar acá (Sabores, glosa, Duplicar artículo, Historial de Artículos, rediseño de Dashboard/Sidebar mobile).*
