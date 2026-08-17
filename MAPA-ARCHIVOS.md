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
| `ventas/page.tsx` | **Ventas POS**: carrito, multi-pago, bloqueada sin caja abierta. Usa `BuscadorProductos.tsx`, `CarritoItems.tsx` (columna Precio Unit. agregada 17/07), `PanelPagos.tsx`. Checkbox Fiscalizar dispara `fiscalizarVenta()` (ver `lib/tusfacturas/fiscalizar.ts`). **Selector de Cliente (15/08)** en la barra superior — Consumidor Final + clientes con cta cte habilitada; se resalta en ámbar cuando no es Consumidor Final; `ventas_borrador` ahora también guarda/restaura `cliente_id`. |
| `ventas/registro/page.tsx` | **Registro de Ventas**: filtros período/turno/medio/estado (incluye `estado_venta_id=5` "Fiscalizado externamente"), `anularVenta` (solo para "Guardada"), botón Editar abre `EditarItemsVentaModal.tsx`. **Botón "Generar Remito" (15/08)** en el detalle expandido de cada venta no anulada — PDF `jsPDF`, lee `venta_items` en vivo, numeración propia (`remitos`/`numeracion_remitos`, sin CAE de ARCA, no es documento fiscal). |
| `fiscalizacion/page.tsx` | **Nuevo (27/07).** Reintento manual de fiscalización — lista ventas Guardadas sin fiscalizar o Rechazadas (`estado_venta_id` 1 o 2), con selector de Cliente y Contado/Cuenta corriente (si el cliente elegido tiene cta cte). Filtros **Rechazadas/Error \| Sin fiscalizar \| Todas** (ese orden, default en Rechazadas/Error). Muestra `comprobantes.mensaje_error` del último intento. Llama a `api/fiscalizacion/route.ts` (gate rol Admin adentro del endpoint, no en la página). |
| `movimientos/page.tsx` | Listado de movimientos (ledger). Filtros Día/Mes/Año/Libre/Todos, checkbox "Excluir movimientos internos de Caja", filtro por Medio de Pago (17/07). |
| `movimientos/nuevo/page.tsx` | Alta de movimiento financiero manual (usa `MovimientoForm.tsx`). |
| `movimientos/[id]/page.tsx` | Edición de movimiento. Gate: Admin siempre puede, otro usuario solo si `cierre_turno_id` = cierre activo; solo movimientos manuales (`origen_tipo IS NULL`). |
| `obligaciones/page.tsx` | **Nuevo (29/07).** Cuenta corriente por acreedor (impuestos, sueldos, servicios, profesionales). Categorías como tarjetas colapsables (cerradas por default; tocar una puntual la auto-abre; "Todas" fuerza cierre de todas). Cada acreedor expandible con detalle Cargo/Pago/Saldo corrido (calculado al vuelo). Modales "+ Nuevo cargo" (no toca `movimientos`) y "+ Registrar pago" total/parcial (genera el Egreso real y lo enlaza vía `movimiento_id`). Conceptos disponibles por acreedor filtrados por la tabla puente `acreedor_conceptos`, no por categoría. |
| `clientes/page.tsx` | **Nuevo (15/08).** Listado de Clientes. Buscador (nombre/DNI/CUIT/teléfono/email), filtro Todos/Consumidor Final/Cuenta Corriente, checkbox "Solo activos". Ícono de estrella junto al nombre de los clientes con cta cte. |
| `clientes/nuevo/page.tsx`, `clientes/[id]/page.tsx` | **Nuevos (15/08).** Alta/edición, usan `ClienteForm.tsx`. |
| `clientes/cuenta-corriente/page.tsx` | **Nuevo (15/08).** Cuenta corriente de clientes (espejo de Obligaciones, en sentido inverso). Cargo = automático, derivado de `venta_pagos` con medio "Cuenta Corriente" (no se carga a mano). Cobro = manual (total o parcial), genera un `movimiento` real de Ingreso vinculado por `movimiento_id`. Filtro "Solo clientes con saldo pendiente" (default on), ordenado por saldo descendente. Modal "Registrar cobro". |
| `presupuestos/page.tsx` | **Nuevo (15/08).** Listado de Presupuestos, buscador por número/cliente, filtro por estado (Borrador/Enviado/Aprobado/Rechazado/Vencido/Convertido). Ícono Editar a la derecha (mismo patrón que Clientes). |
| `presupuestos/nuevo/page.tsx`, `presupuestos/[id]/page.tsx` | **Nuevos (15/08).** Alta/edición, usan `PresupuestoForm.tsx`. |
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
| `reportes/page.tsx` | **Gráficos** — Ventas mensuales + Punto de Equilibrio, Utilidad mensual (3 barras), ventana navegable de 13 meses. Ya no es "pendiente de desarrollo" (dato viejo corregido 15/08). |
| `reportes/ventas/page.tsx` | **Nuevo (15/08).** Reporte de ventas por rubro/artículo. Filtro de fecha idéntico al de Movimientos (Día/Mes/Año/Libre/Todos con flechas), filtro multi-select de Rubros (dropdown checkboxes), columnas ordenables por click. **Fix real:** usa `articulos.nombre` (con sabor), no `nombre_base` — la primera versión agrupaba por error artículos de distinto sabor bajo el mismo texto. |
| `reportes/sugerencia-compra/page.tsx` | **Nuevo (15/08).** Cobertura por velocidad de venta real (período configurable: último mes/3/6/12 meses), umbral y objetivo de cobertura configurables, cruce con OC en Borrador (columna "Cant. pedida"), agrupado por proveedor de la compra Confirmada más reciente de cada artículo ("Sin proveedor asignado" al final). Orden: Cant. sugerida desc, desempate por venta promedio mensual desc. |
| `configuracion/page.tsx` | `[?]` Configuración general — sin detalle reciente registrado. |
| `diagnostico/page.tsx` | Herramienta temporal (scanner de código de barras, sesión 16). **Pendiente borrar.** |
| `layout.tsx` (dentro de `(sistema)/`) | Layout compartido — incluye `Sidebar.tsx` y `Header.tsx`. |

## API routes — `src/app/api/`

| Ruta | Qué hace |
|---|---|
| `api/ventas/route.ts` | Confirma una venta desde el POS: inserta `ventas`/`venta_items`/`venta_pagos`, movimiento financiero (una fila por medio de pago, fix 17/07) y movimiento de stock. **Simplificado 27/07**: la fiscalización ya no vive acá — llama a `fiscalizarVenta()` de `lib/tusfacturas/fiscalizar.ts`. **15/08:** recibe `cliente_id` real del body (antes hardcodeado a `1`), lo usa en el `INSERT` de `ventas` y en `fiscalizarVenta()`. Excluye explícitamente los pagos con medio "Cuenta Corriente" del cálculo del movimiento financiero — bug real corregido, hubiera duplicado el ingreso (ficticio al vender + real al cobrar). |
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
| `clientes/ClienteForm.tsx` | **Nuevo (15/08).** Formulario compartido alta/edición de cliente — identificación (DNI/CUIT/condición IVA), contacto, condiciones comerciales (tipo, cta cte + plazo, descuento default). |
| `presupuestos/PresupuestoForm.tsx` | **Nuevo (15/08).** Formulario compartido de Presupuesto. Buscador de artículos sin filtrar por stock (match por todas las palabras sin importar orden, navegación ↑↓+Enter), cálculo de faltante de compra (cantidad − stock − OC en Borrador), botón "+ Agregar condiciones estándar" (usa el plazo de cta cte del cliente si lo tiene, no duplica), "Generar PDF" (`jsPDF`+`jspdf-autotable`, client-side), "Enviar a borrador de venta" (solo en Aprobado, copia ítems a `ventas_borrador` nuevo con `cliente_id`). |
| `layout/Header.tsx` | Encabezado del sistema. |
| `layout/Sidebar.tsx` | Menú lateral, drawer en mobile (22/07). **Reescrito 15/08**: acordeón generalizado (`Set` de labels abiertos, soporta múltiples grupos — antes solo funcionaba bien con uno). Orden actual: Dashboard, Caja, Ventas, Registro Ventas, Pedidos Web, **Presupuestos** (nuevo), grupo **Clientes** (Listado/Cuenta Corriente, nuevo), Fiscalización, Movimientos, Obligaciones, grupo Artículos, Compras, grupo **Reportes** (Gráficos/Ventas/Sugerencia de Compra, reestructurado), Configuración. |
| `movimientos/MovimientoForm.tsx` | Formulario compartido de movimiento (alta y edición). **29/07:** campo "Período" (mes, separado de Fecha — solo referencia, NO alimenta `mes_contable`) y "Fecha de vencimiento" (opcional); ambos ocultos si Categoría="Caja". Bloqueo real (+ aviso en vivo) de guardar en Efectivo sin turno abierto. |
| `stock/MovimientoStockForm.tsx` | Formulario compartido de movimiento de stock manual. |
| `ui/button.tsx` | Componente genérico de botón (shadcn/ui). |
| `ventas/BuscadorProductos.tsx` | Buscador de artículos en Ventas POS. Catálogo en memoria, búsqueda tokenizada, blindaje anti-rebote de scanner, scroll fix con flechas (13/07). |
| `ventas/CarritoItems.tsx` | Carrito de Ventas POS. Columna "Precio Unit." (17/07). |
| `ventas/EditarItemsVentaModal.tsx` | Modal "Editar ítems" (Caso A) — ediciones en ventas Guardadas, delta de stock, auditoría, diferencia de cobro. |
| `ventas/PanelPagos.tsx` | Panel de medios de pago multi-pago. Ancho ampliado, "Restan pagar" prominente, edición de pagos ya cargados (17/07). **15/08:** recibe `clienteId`/`clienteTieneCtaCte`; "Cuenta Corriente" solo aparece en el combo si el cliente la tiene habilitada; preselección automática de medio según cliente (editable); aviso ámbar al usarla; cambiar de cliente limpia los pagos cargados. |

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
- **Circuito de Nota de Crédito no existe todavía** — gap de esquema `comprobantes.venta_id UNIQUE` sigue bloqueando guardar una NC real en `comprobantes`. **[?] Este archivo puede estar desactualizado en este punto** — hay referencias en memoria a un circuito de NC construido en sesión 13-14/08 que no llegó a volcarse acá; confirmar contra el código real antes de asumir el estado.
- **`Obligaciones` es independiente de `movimientos.estado_cobro_id`** — esa columna existe en `movimientos` pero está sin usar (verificado 30/07); el modelo de deuda es la tabla `obligaciones` nueva, no confundir los dos.
- **Cuenta Corriente de Clientes probada de punta a punta en producción (15/08)** con una venta real a la Municipalidad (#1540/id 239): venta con medio Cuenta Corriente → cargo visible → cobro por Transferencia → saldo $0 → movimiento real verificado → limpieza completa de la prueba vía `Anular` (nunca `UPDATE` directo a stock).
- **Aclaración legal confirmada (RG 1415 AFIP/ARCA):** en una venta a cuenta corriente, la Factura se emite en el momento de la entrega de la mercadería, no cuando se cobra — el plazo de pago pactado es una condición comercial que no mueve el momento fiscal. Remito no requiere CAE (no es documento fiscal).
- **Presupuesto #1 real enviado** a la Municipalidad de Cinco Saltos el 15/08 ($1.171.000, condiciones a 15 días, validez hasta 24/08/2026) — primer uso real del módulo Presupuestos.

---

*Última actualización: 15/08/2026 — sesión: submenú Reportes (Gráficos/Ventas/Sugerencia de Compra), módulo Clientes (CRUD + 71 clientes importados de Empretienda + Viviana Godoy), Cuenta Corriente de Clientes (probada de punta a punta con venta real), módulo Presupuestos completo (alta, PDF, faltante de compra, envío a borrador de venta), Remito en PDF, Sidebar reestructurado (acordeón generalizado). Ver `ESTADO-PROYECTO.md` Bloque 18 para el detalle completo.*
