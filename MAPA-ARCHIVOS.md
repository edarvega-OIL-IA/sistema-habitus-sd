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
| `articulos/page.tsx` | Listado de artículos. Filtros Disponibilidad (local/web/todos) y Stock (con/sin/todos), búsqueda tokenizada sin acentos (incluye rubro y marca). |
| `articulos/nuevo/page.tsx` | Alta de artículo nuevo (usa el formulario compartido `ArticuloForm.tsx`). |
| `articulos/[id]/page.tsx` | Edición de artículo existente (mismo formulario compartido). |
| `cierre-turno/page.tsx` | Pantalla **Caja**: apertura, cierre, retiro y reapertura de turno con auditoría. Contiene el fix de "Ingresos efectivo" duplicado (excluye `origen_tipo='venta'`). |
| `compras/page.tsx` | Listado de Órdenes de Compra. Detalle expandible con ítems, columnas Compra/Flete/Total, fila ámbar para ítems de ajuste por redondeo. |
| `compras/nueva/page.tsx` | Alta de nueva Orden de Compra. Genera movimiento de mercadería/flete al guardar (Borrador o Confirmada), valida contra `monto_comprobante`, fix de decimales (`parsearMonto`). |
| `compras/[id]/page.tsx` | Edición de Orden de Compra existente. Revierte y re-aplica stock/costos si estaba Confirmada; función `sincronizarMovimiento()` para no duplicar movimientos. |
| `compras/[id]/page_compras_id_old.tsx` | `[?]` Parece una versión anterior/backup del archivo de edición de Compras (no forma parte del build activo de Next.js al no llamarse `page.tsx`). Candidato a borrar — confirmar que no se necesita antes de eliminarlo. |
| `configuracion/page.tsx` | `[?]` Pantalla de configuración general del sistema — no hay detalle reciente registrado en `ESTADO-PROYECTO.md` sobre su contenido actual. |
| `dashboard/page.tsx` | Dashboard principal. Contiene el mismo fix de "Ingresos efectivo" duplicado que Caja, banner de turno abierto. |
| `diagnostico/page.tsx` | Herramienta temporal creada para diagnosticar el bug del scanner de código de barras (sesión 16). **Pendiente borrar** — ya cumplió su función, confirmado el fix estable. |
| `movimientos/page.tsx` | Listado de movimientos financieros (ledger). Filtros Día/Mes/Año/Libre/Todos con totales arriba, filtrado en cliente. |
| `movimientos/nuevo/page.tsx` | Alta de movimiento financiero manual. Fix de decimales (`parsearMonto`). |
| `reportes/page.tsx` | `[?]` Módulo Reportes — figura como pendiente de desarrollo en `ESTADO-PROYECTO.md`; confirmar si el archivo ya tiene contenido real o es un placeholder. |
| `stock/page.tsx` | Listado de movimientos de stock **manuales** (Consumo interno, Merma, Sponsoreo). Excluye ventas/compras (`origen_tipo` no nulo), traba defensiva Editar/Eliminar, fix de fecha (`.split('-').reverse().join('/')`). |
| `stock/nuevo/page.tsx` | Alta de movimiento de stock manual (usa `MovimientoStockForm.tsx`). |
| `stock/[id]/page.tsx` | Edición de movimiento de stock manual. |
| `ventas/page.tsx` | **Ventas POS**: carrito, modo multi-pago, bloqueada sin caja abierta. Usa `BuscadorProductos.tsx`, `CarritoItems.tsx`, `PanelPagos.tsx`. |
| `ventas/registro/page.tsx` | **Registro de Ventas**: listado con filtros período/turno/medio/estado, función `anularVenta` (reversión trazable, gateada por turno activo), botón Editar que abre `EditarItemsVentaModal.tsx`. |
| `layout.tsx` (dentro de `(sistema)/`) | Layout compartido de las pantallas autenticadas — incluye `Sidebar.tsx` y `Header.tsx`. |

## API routes — `src/app/api/`

| Ruta | Qué hace |
|---|---|
| `api/ventas/route.ts` | Confirma una venta desde el POS: inserta `ventas`/`venta_items`/`venta_pagos`, genera el movimiento financiero (ledger) y el movimiento de stock (Egreso) vía `movimiento_stock_items`. |

## Resto de `src/app/`

| Ruta | Qué hace |
|---|---|
| `login/page.tsx` | Pantalla de login. |
| `layout.tsx` (raíz) | Layout raíz de la aplicación — fuentes (Inter), metadata global. |
| `page.tsx` (raíz) | `[?]` Página raíz de la app — probablemente redirección a `/login` o `/dashboard` según sesión; confirmar comportamiento exacto. |

## Componentes — `src/components/`

| Ruta | Qué hace |
|---|---|
| `articulos/ArticuloForm.tsx` | Formulario compartido de artículo (alta y edición), 5 solapas. Contiene el fix de decimales unificado (`parsearMonto`) y formato visual argentino. |
| `layout/Header.tsx` | Encabezado del sistema. |
| `layout/Sidebar.tsx` | Menú lateral — orden: Dashboard, Caja, Ventas, Registro Ventas, Movimientos, Stock, Compras, Artículos, Reportes, Configuración. |
| `stock/MovimientoStockForm.tsx` | Formulario compartido de movimiento de stock manual (usado por `stock/nuevo` y `stock/[id]`). |
| `ui/button.tsx` | Componente genérico de botón (shadcn/ui). |
| `ventas/BuscadorProductos.tsx` | Buscador de artículos en Ventas POS. Catálogo completo cargado en memoria (no consulta por tecla), búsqueda tokenizada, foco fijo en buscador + blindaje anti-rebote de scanner de código de barras. |
| `ventas/CarritoItems.tsx` | Carrito de ítems dentro de Ventas POS. |
| `ventas/EditarItemsVentaModal.tsx` | Modal "Editar ítems" (Caso A) — edición de artículos/cantidades en ventas Guardadas, delta de stock, historial de auditoría (`venta_items_historial`), diferencia de cobro (mover plata real o ajuste contable). |
| `ventas/PanelPagos.tsx` | Panel de medios de pago multi-pago en Ventas POS — Emisor visible solo si el medio es Débito/Crédito. |

## `src/lib/`

| Ruta | Qué hace |
|---|---|
| `lib/supabase/client.ts` | Cliente Supabase para uso en el navegador (Client Components). |
| `lib/supabase/server.ts` | Cliente Supabase para uso en el servidor (Server Components / API routes). |
| `lib/utils.ts` | `[?]` Utilidades varias — probablemente el helper `cn()` estándar de shadcn/ui para combinar clases de Tailwind; confirmar contenido exacto. |

## Raíz de `src/`

| Ruta | Qué hace |
|---|---|
| `proxy.ts` | Middleware de autenticación — reemplaza a `middleware.ts` (renombrado en Next.js 16). |

---

*Última actualización: 06/07/2026, a partir del listado completo de `src/**/*.tsx` y `*.ts` en producción.*
