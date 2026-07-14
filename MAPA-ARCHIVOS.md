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
| `articulos/precios/page.tsx` | Pantalla unificada de actualización de precios (reemplaza la vieja `compras/[id]/precios/`). Filtros iguales a Artículos + "OC pendiente" + "Solo desactualizados". Utilidad % = (Precio-Costo)/Costo×100. Ajuste masivo por % con preview. Admin-only. |
| `cierre-turno/page.tsx` | Pantalla **Caja**: apertura, cierre, retiro y reapertura de turno con auditoría. Fix de "Ingresos efectivo" duplicado (excluye `origen_tipo='venta'`). |
| `compras/page.tsx` | Listado de Órdenes de Compra. Detalle expandible con ítems, columnas Compra/Flete/Total, fila ámbar para ítems de ajuste por redondeo. Iconos de color en Acciones. |
| `compras/nueva/page.tsx` | Alta de nueva Orden de Compra. Genera movimiento de mercadería/flete al guardar, valida contra `monto_comprobante`, fix de decimales (`parsearMonto`). |
| `compras/[id]/page.tsx` | Edición de Orden de Compra existente. Revierte y re-aplica stock/costos si estaba Confirmada; `sincronizarMovimiento()` para no duplicar movimientos. |
| `compras/[id]/page_compras_id_old.tsx` | `[?]` Versión anterior/backup del archivo de edición de Compras (no forma parte del build activo). Candidato a borrar. |
| `configuracion/page.tsx` | `[?]` Pantalla de configuración general del sistema — sin detalle reciente registrado. |
| `dashboard/page.tsx` | Dashboard principal. Fix de "Ingresos efectivo" duplicado, banner de turno abierto, widget "Efectivo en caja", excluye `categoria_gasto_id=13` (movimientos internos de Caja) del resumen mensual. |
| `diagnostico/page.tsx` | Herramienta temporal para diagnosticar el bug del scanner de código de barras. **Pendiente borrar** — ya cumplió su función. |
| `movimientos/page.tsx` | Listado de movimientos financieros (ledger). Filtros Día/Mes/Año/Libre/Todos con totales arriba. Checkbox "Excluir movimientos internos de Caja". |
| `movimientos/nuevo/page.tsx` | Alta de movimiento financiero manual. Fix de decimales (`parsearMonto`). |
| `movimientos/[id]/page.tsx` | Edición de movimiento financiero, usa `MovimientoForm.tsx` compartido. Gate: Admin siempre puede, otro usuario solo si `movimientos.cierre_turno_id` = cierre activo; solo movimientos manuales (`origen_tipo IS NULL`). |
| `reportes/page.tsx` | `[?]` Módulo Reportes — pendiente de desarrollo. |
| `stock/page.tsx` | Listado de movimientos de stock **manuales** (Consumo interno, Merma, Sponsoreo). Excluye ventas/compras, traba defensiva Editar/Eliminar, fix de fecha. |
| `stock/nuevo/page.tsx` | Alta de movimiento de stock manual (usa `MovimientoStockForm.tsx`). |
| `stock/[id]/page.tsx` | Edición de movimiento de stock manual. |
| `ventas/page.tsx` | **Ventas POS**: carrito, modo multi-pago, bloqueada sin caja abierta. Usa `BuscadorProductos.tsx`, `CarritoItems.tsx`, `PanelPagos.tsx`. Checkbox "Fiscalizar" ahora dispara la fiscalización real vía TusFacturasAPP (desde 14/07). |
| `ventas/registro/page.tsx` | **Registro de Ventas**: listado con filtros período/turno/medio/estado (incluye chip `estado_venta_id=5` "Fiscalizado externamente"), `anularVenta` (reversión trazable, gateada por turno activo, **solo para `estado_venta_id=2` "Guardada"** — no permite anular ventas ya Fiscalizadas/Fiscales, por diseño), botón Editar que abre `EditarItemsVentaModal.tsx`. |
| `layout.tsx` (dentro de `(sistema)/`) | Layout compartido — incluye `Sidebar.tsx` y `Header.tsx`. |

## API routes — `src/app/api/`

| Ruta | Qué hace |
|---|---|
| `api/ventas/route.ts` | Confirma una venta desde el POS: inserta `ventas`/`venta_items`/`venta_pagos`, genera el movimiento financiero y el movimiento de stock. **Pipeline de fiscalización AFIP/ARCA vía TusFacturasAPP ACTIVO EN PRODUCCIÓN desde 14/07** (reserva de numeración, INSERT en `comprobantes`, llamado a `emitirFacturaC`, actualización de estado fiscal), gateado por `fiscalizacionActiva()` / `FISCALIZACION_TUSFACTURAS_ACTIVA=true`. Corregido el 14/07: nombre real del campo de respuesta es `vencimiento_cae` (no `cae_vencimiento`), y se recorta el espacio final del CAE (`.trim()`). |

## Resto de `src/app/`

| Ruta | Qué hace |
|---|---|
| `login/page.tsx` | Pantalla de login. |
| `layout.tsx` (raíz) | Layout raíz — fuentes (Inter), metadata global. |
| `page.tsx` (raíz) | `[?]` Página raíz — probablemente redirección a `/login` o `/dashboard` según sesión. |

## Componentes — `src/components/`

| Ruta | Qué hace |
|---|---|
| `articulos/ArticuloForm.tsx` | Formulario compartido de artículo, 5 solapas. Fix de decimales unificado. Inserta en `historico_precios` al cambiar `precio_local` a mano. GAP PENDIENTE: no oculta el costo para Encargado (rol_id=2). |
| `layout/Header.tsx` | Encabezado del sistema. |
| `layout/Sidebar.tsx` | Menú lateral — orden: Dashboard, Caja, Ventas, Registro Ventas, Movimientos, Stock, Compras, Artículos, Reportes, Configuración. |
| `movimientos/MovimientoForm.tsx` | Formulario compartido de movimiento financiero (alta y edición). |
| `stock/MovimientoStockForm.tsx` | Formulario compartido de movimiento de stock manual. |
| `ui/button.tsx` | Componente genérico de botón (shadcn/ui). |
| `ventas/BuscadorProductos.tsx` | Buscador de artículos en Ventas POS. Catálogo en memoria, búsqueda tokenizada, blindaje anti-rebote de scanner. |
| `ventas/CarritoItems.tsx` | Carrito de ítems dentro de Ventas POS. |
| `ventas/EditarItemsVentaModal.tsx` | Modal "Editar ítems" (Caso A) — edición de artículos/cantidades en ventas Guardadas, delta de stock, historial de auditoría, diferencia de cobro. |
| `ventas/PanelPagos.tsx` | Panel de medios de pago multi-pago en Ventas POS. |

## `src/lib/`

| Ruta | Qué hace |
|---|---|
| `lib/supabase/client.ts` | Cliente Supabase para el navegador. |
| `lib/supabase/server.ts` | Cliente Supabase para el servidor. |
| `lib/utils.ts` | `[?]` Utilidades varias — probablemente `cn()` de shadcn/ui. |
| `lib/tusfacturas/tipos.ts` | Tipos TypeScript del request/response de TusFacturasAPP (Factura C). **Actualizado 14/07**: agregados `vencimiento`, `idioma`, `periodo_facturado_desde/hasta` (comprobante); `codigo`, `rg5329` (cliente); `unidad_medida`, `actualiza_precio`, `rg5329` (producto); `afecta_stock` (detalle). Corregido el nombre real de la respuesta: `vencimiento_cae` (no `cae_vencimiento`). |
| `lib/tusfacturas/mapeo.ts` | Función `mapearVentaAFacturaC(venta, numeroComprobante)`. **Actualizado 14/07**: cálculo dinámico de `bonificacion` general (subtotal detalle − total, necesario para ventas con descuento), completados los 8 campos obligatorios nuevos. Exporta `PUNTO_VENTA_ID=3` y `TIPO_COMPROBANTE_ID_FACTURA=1`. |
| `lib/tusfacturas/emitir.ts` | Llamado real a la API (`POST /app/api/v2/facturacion/nuevo`) + `fiscalizacionActiva()`. Sin cambios en esta sesión. |

## Raíz de `src/`

| Ruta | Qué hace |
|---|---|
| `proxy.ts` | Middleware de autenticación — reemplaza a `middleware.ts` (Next.js 16). |

---

## Notas operativas relevantes (no son archivos, pero afectan cómo se usan)

- **`FISCALIZACION_TUSFACTURAS_ACTIVA=true` está ACTIVO en Vercel desde el 14/07/2026** — cualquier venta con "Fiscalizar" tildado desde ese momento genera una factura C real ante ARCA, sin intervención manual. Tenerlo presente antes de hacer cualquier prueba futura en producción.
- **Circuito de Nota de Crédito no existe todavía dentro del sistema** — si hace falta anular una venta que ya tiene CAE real, hoy se hace a mano por fuera del sistema (llamado directo a la API de TusFacturasAPP). Hay un gap de esquema conocido (`comprobantes.venta_id` es `UNIQUE`) que bloquea guardar la NC en la tabla `comprobantes` — pendiente de resolver cuando se construya la pantalla real.

---

*Última actualización: 14/07/2026 — sesión de activación real de TusFacturasAPP: correcciones en `tipos.ts`, `mapeo.ts` y `api/ventas/route.ts` (ver `ESTADO-PROYECTO.md` sección 19 para el detalle completo de bugs encontrados y corregidos).*
