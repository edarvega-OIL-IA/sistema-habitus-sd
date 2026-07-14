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
| `articulos/page.tsx` | Listado de artículos. Filtros Disponibilidad (local/web/todos) y Stock (con/sin/todos), búsqueda tokenizada sin acentos (incluye rubro y marca). Botón "Actualizar precios" visible solo Admin, lleva a `articulos/precios/page.tsx`. |
| `articulos/nuevo/page.tsx` | Alta de artículo nuevo (usa el formulario compartido `ArticuloForm.tsx`). |
| `articulos/[id]/page.tsx` | Edición de artículo existente (mismo formulario compartido). |
| `articulos/precios/page.tsx` | **Pantalla unificada de actualización de precios** (13/07, reemplaza la vieja `compras/[id]/precios/`). Filtros iguales a Artículos + "OC pendiente" (solo Borrador, combinable) + "Solo desactualizados". Costo sin OC = `articulos.costo_sin_iva`; con OC = `costo_final_unitario` de esa orden puntual. Utilidad % = (Precio-Costo)/Costo×100. Columna "Actualizado" con indicador ⚠ naranja si el costo cambió después de la última revisión de precio (comparado por `creado_en`, no por fecha). Ajuste masivo por % con preview. Admin-only. |
| `cierre-turno/page.tsx` | Pantalla **Caja**: apertura, cierre, retiro y reapertura de turno con auditoría. Contiene el fix de "Ingresos efectivo" duplicado (excluye `origen_tipo='venta'`). |
| `compras/page.tsx` | Listado de Órdenes de Compra. Detalle expandible con ítems, columnas Compra/Flete/Total, fila ámbar para ítems de ajuste por redondeo. Iconos de color en Acciones (mismo patrón que Artículos). |
| `compras/nueva/page.tsx` | Alta de nueva Orden de Compra. Genera movimiento de mercadería/flete al guardar (Borrador o Confirmada), valida contra `monto_comprobante`, fix de decimales (`parsearMonto`). |
| `compras/[id]/page.tsx` | Edición de Orden de Compra existente. Revierte y re-aplica stock/costos si estaba Confirmada; función `sincronizarMovimiento()` para no duplicar movimientos. |
| `compras/[id]/page_compras_id_old.tsx` | `[?]` Versión anterior/backup del archivo de edición de Compras (no forma parte del build activo). Candidato a borrar — pendiente confirmar antes de eliminarlo. |
| `configuracion/page.tsx` | `[?]` Pantalla de configuración general del sistema — sin detalle reciente registrado. |
| `dashboard/page.tsx` | Dashboard principal. Fix de "Ingresos efectivo" duplicado, banner de turno abierto, widget "Efectivo en caja" (13/07), excluye `categoria_gasto_id=13` (movimientos internos de Caja) del resumen mensual Ingresos/Egresos. |
| `diagnostico/page.tsx` | Herramienta temporal para diagnosticar el bug del scanner de código de barras (sesión 16). **Pendiente borrar** — ya cumplió su función. |
| `movimientos/page.tsx` | Listado de movimientos financieros (ledger). Filtros Día/Mes/Año/Libre/Todos con totales arriba, filtrado en cliente. Checkbox "Excluir movimientos internos de Caja" (13/07). |
| `movimientos/nuevo/page.tsx` | Alta de movimiento financiero manual. Fix de decimales (`parsearMonto`). |
| `movimientos/[id]/page.tsx` | **Nuevo (13/07).** Edición de movimiento financiero, usa `MovimientoForm.tsx` compartido. Gate: Admin siempre puede, otro usuario solo si `movimientos.cierre_turno_id` = cierre activo; solo movimientos manuales (`origen_tipo IS NULL`). |
| `reportes/page.tsx` | `[?]` Módulo Reportes — pendiente de desarrollo según `ESTADO-PROYECTO.md`. |
| `stock/page.tsx` | Listado de movimientos de stock **manuales** (Consumo interno, Merma, Sponsoreo). Excluye ventas/compras (`origen_tipo` no nulo), traba defensiva Editar/Eliminar, fix de fecha (`.split('-').reverse().join('/')`). |
| `stock/nuevo/page.tsx` | Alta de movimiento de stock manual (usa `MovimientoStockForm.tsx`). |
| `stock/[id]/page.tsx` | Edición de movimiento de stock manual. |
| `ventas/page.tsx` | **Ventas POS**: carrito, modo multi-pago, bloqueada sin caja abierta. Usa `BuscadorProductos.tsx`, `CarritoItems.tsx`, `PanelPagos.tsx`. |
| `ventas/registro/page.tsx` | **Registro de Ventas**: listado con filtros período/turno/medio/estado (incluye chip `estado_venta_id=5` "Fiscalizado externamente", agregado 13/07), función `anularVenta` (reversión trazable, gateada por turno activo), botón Editar que abre `EditarItemsVentaModal.tsx`. |
| `layout.tsx` (dentro de `(sistema)/`) | Layout compartido de las pantallas autenticadas — incluye `Sidebar.tsx` y `Header.tsx`. |

## API routes — `src/app/api/`

| Ruta | Qué hace |
|---|---|
| `api/ventas/route.ts` | Confirma una venta desde el POS: inserta `ventas`/`venta_items`/`venta_pagos`, genera el movimiento financiero (ledger) y el movimiento de stock (Egreso) vía `movimiento_stock_items`. **Reescrito completo el 13/07**: agrega el pipeline de fiscalización AFIP/ARCA vía TusFacturasAPP (reserva de numeración, INSERT en `comprobantes`, llamado a `emitirFacturaC`, actualización de estado fiscal), todo gateado por `fiscalizacionActiva()` — inactivo mientras `FISCALIZACION_TUSFACTURAS_ACTIVA` no esté en `'true'` en Vercel. |

## Resto de `src/app/`

| Ruta | Qué hace |
|---|---|
| `login/page.tsx` | Pantalla de login. |
| `layout.tsx` (raíz) | Layout raíz de la aplicación — fuentes (Inter), metadata global. |
| `page.tsx` (raíz) | `[?]` Página raíz de la app — probablemente redirección a `/login` o `/dashboard` según sesión; confirmar comportamiento exacto. |

## Componentes — `src/components/`

| Ruta | Qué hace |
|---|---|
| `articulos/ArticuloForm.tsx` | Formulario compartido de artículo (alta y edición), 5 solapas. Fix de decimales unificado (`parsearMonto`), formato visual argentino. Inserta en `historico_precios` (tipo='precio_manual') al cambiar `precio_local` a mano (13/07). GAP PENDIENTE: no oculta el costo para Encargado (rol_id=2). |
| `layout/Header.tsx` | Encabezado del sistema. |
| `layout/Sidebar.tsx` | Menú lateral — orden: Dashboard, Caja, Ventas, Registro Ventas, Movimientos, Stock, Compras, Artículos, Reportes, Configuración. |
| `movimientos/MovimientoForm.tsx` | **Nuevo (13/07).** Formulario compartido de movimiento financiero, usado por alta y edición (`movimientos/nuevo` y `movimientos/[id]`). |
| `stock/MovimientoStockForm.tsx` | Formulario compartido de movimiento de stock manual (usado por `stock/nuevo` y `stock/[id]`). |
| `ui/button.tsx` | Componente genérico de botón (shadcn/ui). |
| `ventas/BuscadorProductos.tsx` | Buscador de artículos en Ventas POS. Catálogo completo cargado en memoria, búsqueda tokenizada, foco fijo en buscador + blindaje anti-rebote de scanner. Fix de scroll (13/07): `itemRefs` + `scrollIntoView` para que el ítem resaltado con flechas no se salga del dropdown visible. |
| `ventas/CarritoItems.tsx` | Carrito de ítems dentro de Ventas POS. |
| `ventas/EditarItemsVentaModal.tsx` | Modal "Editar ítems" (Caso A) — edición de artículos/cantidades en ventas Guardadas, delta de stock, historial de auditoría (`venta_items_historial`), diferencia de cobro (mover plata real o ajuste contable, categoría 14/concepto 45 para devoluciones). |
| `ventas/PanelPagos.tsx` | Panel de medios de pago multi-pago en Ventas POS — Emisor visible solo si el medio es Débito/Crédito. |

## `src/lib/`

| Ruta | Qué hace |
|---|---|
| `lib/supabase/client.ts` | Cliente Supabase para uso en el navegador (Client Components). |
| `lib/supabase/server.ts` | Cliente Supabase para uso en el servidor (Server Components / API routes). |
| `lib/utils.ts` | `[?]` Utilidades varias — probablemente el helper `cn()` estándar de shadcn/ui; confirmar contenido exacto. |
| `lib/tusfacturas/tipos.ts` | **Nuevo (13/07).** Tipos TypeScript del request/response de la API de TusFacturasAPP (Factura C). |
| `lib/tusfacturas/mapeo.ts` | **Nuevo (13/07).** Función `mapearVentaAFacturaC(venta, numeroComprobante)`: convierte una venta del sistema al JSON de TusFacturasAPP. Resuelve cliente (CUIT/DNI/Consumidor Final), código de provincia fijo Río Negro=16. Exporta `PUNTO_VENTA_ID=3` y `TIPO_COMPROBANTE_ID_FACTURA=1`. |
| `lib/tusfacturas/emitir.ts` | **Nuevo (13/07).** Llamado real a la API (`POST /app/api/v2/facturacion/nuevo`) + `fiscalizacionActiva()`, que lee la variable de entorno `FISCALIZACION_TUSFACTURAS_ACTIVA`. Único punto del sistema donde se decide si se llama de verdad a TusFacturasAPP. |

## Raíz de `src/`

| Ruta | Qué hace |
|---|---|
| `proxy.ts` | Middleware de autenticación — reemplaza a `middleware.ts` (renombrado en Next.js 16). |

---

*Última actualización: 13/07/2026 — agregados los 3 archivos nuevos de `src/lib/tusfacturas/`, la reescritura de `api/ventas/route.ts`, `articulos/precios/page.tsx`, `movimientos/[id]/page.tsx` y `movimientos/MovimientoForm.tsx`.*
