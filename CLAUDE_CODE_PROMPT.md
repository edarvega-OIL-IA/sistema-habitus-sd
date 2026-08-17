# Contexto para Claude Code — Sistema Habitus SD

## Proyecto
Sistema de gestión para local de suplementos deportivos "Habitus SD" (Cinco Saltos, Río Negro).
Reemplaza coverweb.com.ar. Stack confirmado y configurado.

## Ruta del proyecto
C:\Users\Usuario\Documents\sistema-habitus-sd

## Deploy
- Repositorio: https://github.com/edarvega-OIL-IA/sistema-habitus-sd (privado, rama master)
- Vercel: https://sistema-habitus-sd.vercel.app (deploy automático en push)
- Workflow deploy: `git add -A` → `git commit -m "..."` → `git push`
- PowerShell: usar `;` como separador (NO `&&`)

## Stack
- Next.js 16 (App Router) + TypeScript
- Supabase (PostgreSQL + RLS + Auth)
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- Tipografía: Inter (Google Fonts)

## Colores de marca
- Primary: #00a19a (Persian Green)
- Texto/fondo oscuro: #3c3c3b (Onyx)
- Fondo claro: #ededed (Anti-flash White)

## Estructura de rutas
src/app/(sistema)/
  dashboard/page.tsx
  ventas/page.tsx
  ventas/registro/page.tsx
  articulos/page.tsx
  articulos/nuevo/page.tsx
  articulos/[id]/page.tsx
  articulos/precios/page.tsx
  articulos/historial/page.tsx
  compras/page.tsx
  compras/nueva/page.tsx
  compras/[id]/page.tsx
  movimientos/page.tsx
  movimientos/nuevo/page.tsx
  movimientos/[id]/page.tsx
  obligaciones/page.tsx (nuevo 29/07 — cuenta corriente por acreedor)
  fiscalizacion/page.tsx (nuevo 27/07 — reintento manual de fiscalización, rol Admin)
  clientes/page.tsx, clientes/nuevo/page.tsx, clientes/[id]/page.tsx (nuevo 15/08)
  clientes/cuenta-corriente/page.tsx (nuevo 15/08 — cuenta corriente de clientes)
  presupuestos/page.tsx, presupuestos/nuevo/page.tsx, presupuestos/[id]/page.tsx (nuevo 15/08)
  stock/page.tsx
  stock/nuevo/page.tsx
  stock/[id]/page.tsx
  cierre-turno/page.tsx
  reportes/page.tsx (Gráficos)
  reportes/ventas/page.tsx (nuevo 15/08)
  reportes/sugerencia-compra/page.tsx (nuevo 15/08)
  configuracion/page.tsx

src/app/api/ventas/route.ts (simplificado 27/07 — usa lib/tusfacturas/fiscalizar.ts; 15/08 — recibe cliente_id real, excluye Cuenta Corriente del movimiento financiero)
src/app/api/fiscalizacion/route.ts (nuevo 27/07)
src/lib/tusfacturas/fiscalizar.ts (nuevo 27/07 — pipeline compartido POS automático + reintento manual)
src/lib/tusfacturas/mapeo.ts / tipos.ts / emitir.ts
src/components/ventas/PanelPagos.tsx (15/08 — selector de cliente, filtra/preselecciona Cuenta Corriente)
src/components/articulos/ArticuloForm.tsx
src/components/movimientos/MovimientoForm.tsx
src/components/stock/MovimientoStockForm.tsx
src/components/clientes/ClienteForm.tsx (nuevo 15/08)
src/components/presupuestos/PresupuestoForm.tsx (nuevo 15/08 — PDF con jsPDF+jspdf-autotable)
src/lib/supabase/client.ts / server.ts
src/proxy.ts (reemplaza middleware.ts en Next.js 16)

## Patrones establecidos
- Queries separadas + merge por Map para relaciones con RLS (NUNCA join anidado)
- Filtrado siempre en cliente (load-all + filter)
- Server Components para queries; Client Components solo con interactividad

## Reglas de UI críticas
- Buscador SIEMPRE arriba de la lista
- Campo búsqueda POS: autofocus permanente + texto siempre seleccionado
- Botones Fiscalizar/Guardar: color verde por estado React (btnVerde/btnBlanco/btnDis), NO por CSS :focus
- Inputs de monto: type="text" inputMode="numeric" — NUNCA type="number"
- Parseo montos: parseFloat(v.replace(/\./g,'').replace(',','.')) || 0
- Display montos: n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
- React Hook Form montos: setValueAs, NO valueAsNumber: true
- Notificaciones error: div rojo/verde con X, NO alert()
- Fechas DATE: mostrar con .substring(0,10).split('-').reverse().join('/'), NUNCA new Date()
- Horas (TIMESTAMPTZ): new Date(s).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

## FUENTE DE VERDAD DE BD — verificado hasta el 15/08/2026
**REGLA: Nunca documentar columnas sin verificar con SELECT en producción.**

### Catálogo
- articulos: id, nombre, nombre_base, sabor_id(nullable, FK sabores), rubro_id(nullable), marca_id(nullable), codigo_interno, codigo_barra, sku, unidad_medida_id, costo_sin_iva, tasa_iva_id, precio_local, precio_web, precio_mayorista, precio_oferta_web, disponible_local, disponible_web, visible_en_tienda, id_producto_web, id_stock_web, atributo_nombre, atributo_valor, peso_kg, descripcion, id_migracion, activo, creado_en, actualizado_en
- rubros: id, nombre, activo, creado_en — ids 1-19, 22, 23
- marcas: id, nombre, activo, creado_en — ids 1-16, 18, 20-41
- unidades_medida: id, nombre, abreviatura, creado_en — Unidad=4, Pack=5, Caja=6
- tasas_iva: id, nombre, porcentaje, activo, creado_en — 21%=4, 10.5%=5, 0%=6
- sabores (sesión 25/07): id, nombre, activo, creado_en — 26 cargados (Chocolate, Vainilla, Frutilla, Banana, Frutos Rojos, Dulce De Leche, Cookies, Neutro, Café, Coco, Limón, Maracuyá, Menta, Pistacho, Almendras, Avellana, Manzana, Caramelo, Cereza, Multifrutas, Naranja, Ananá, Uva, Citrus, Mango, Arándano, Pomelo)
- componentes (sesión 25/07): id, nombre, activo, creado_en — hoy solo "Cafeína". Tabla puente `articulo_componentes` (articulo_id, componente_id) para filtro "¿tenés algo con X?" (Resveratrol, Vitamina D, etc. cuando aparezcan)
- **Trigger `fn_generar_nombre_articulo`** (sesión 25/07): arma `articulos.nombre` solo (`nombre_base + atributo_valor + marca`) en cada INSERT/UPDATE de esos 3 campos, SOLO si `nombre_base IS NOT NULL`. El campo Nombre en `ArticuloForm.tsx` queda de solo lectura cuando hay `nombre_base` cargado.
- **5 rubros migrados al sistema de sabores** (de ~20 totales): Proteínas (74), Creatinas (32), Barras de proteína (53), Geles (59 activos de 71), Bebidas Isotónicas (19 activos de 31). El resto del catálogo sigue con `nombre_base`/`sabor_id` en NULL — el trigger no los toca.

### Ventas y pagos
- ventas: id, numero_venta, cliente_id, sucursal_id, usuario_id, estado_venta_id, descuento_pct, recargo_pct, subtotal, total, observaciones, fecha_utc(DATE), creado_en, cierre_turno_id, mes_contable
- venta_items: id, venta_id, articulo_id, cantidad, precio_unitario, descuento_pct, subtotal, creado_en
- venta_pagos: id, venta_id, medio_pago_id, monto, tarjeta_id, cupon, numero_autorizacion, cuenta_bancaria_id, referencia, creado_en, emisor_pago_id, payment_method_raw
- medios_pago: id, nombre, fiscaliza_por_defecto, activo, creado_en — Efectivo=1, Débito=2, Crédito=3, Transferencia=4, QR Mercado Pago=5
- emisores_pago: id, nombre, fiscaliza, activo, creado_en — Mercado Pago=7
- estados_venta: id, nombre — 1=Fiscal, 2=Guardado, 3=Anulada, 4=Fiscalizada, 5=Fiscalizado externamente (agregado 08/07/2026 — ventas facturadas por fuera del sistema propio, ej. Cover durante el período paralelo; nombres corregidos contra SELECT real en producción, NO coincidían con lo documentado antes)
- clientes: id, nombre(texto único, NO nombre/apellido separados), tipo_cliente_id(FK tipos_cliente: 1=Consumidor Final, 2=Cuenta Corriente), cuit, dni, condicion_iva_id(FK condiciones_iva: 1=RI, 2=Monotributista, 3=Exento, 4=Consumidor Final, 5=No Responsable), domicilio, localidad_id(FK localidades — tabla acotada al Alto Valle Río Negro/Neuquén, NO es catálogo nacional, verificado 15/08), telefono, email, tiene_cuenta_corriente(bool), plazo_dias_cta_cte, descuento_default_pct, notas, activo, creado_en — id=1 Consumidor Final (default), id=2 Municipalidad de Cinco Saltos (cta cte 15 días). **73 clientes cargados al 15/08** (2 originales + 71 importados de Empretienda/vitrina propia).
- **IMPORTANTE (incidente 27/07, repetido 15/08):** `condiciones_iva`, `localidades` y `tipos_cliente` son tablas viejas — verificar SIEMPRE que tengan RLS+GRANT antes de sumarles un JOIN nuevo. La propia `clientes` tuvo el mismo gap el 15/08 (solo política SELECT, sin GRANT de INSERT/UPDATE para `authenticated`) — corregido, pero recordar verificar las 4 políticas en CUALQUIER tabla antes de construir un formulario de alta/edición sobre ella, no solo en tablas nuevas.
- comprobantes: id, venta_id, tipo_comprobante_id, punto_venta_id, numero, comprobante_asociado_id, estado_fiscal_id, factura_cae, factura_cae_vencimiento, fecha_emision_utc, fiscalizacion_intentos, mensaje_error(TEXT, agregado 29/07 — motivo real de rechazo de ARCA/TusFacturasAPP, antes se perdía), creado_en, total, impreso_enviado
- estados_fiscales: 1=Pendiente, 2=Enviado, 3=CAE_Recibido, 4=CAE_Rechazado, 5=Reintentando, 6=Anulado
- numeracion_comprobantes: id, punto_venta_id, tipo_comprobante_id, ultimo_numero — **si se emite una factura a mano por el portal web de TusFacturasAPP (no por la API), este contador NO se entera solo; hay que corregirlo a mano antes de la próxima fiscalización por sistema**, o va a pedir un número ya usado ante ARCA.

### Movimientos financieros
- categorias_gasto: id, nombre, tipo(Ingreso/Egreso/Ambos/Sistema), creado_en — NO tiene activo
- conceptos_gasto: id, categoria_gasto_id, nombre, tipo, creado_en
- movimientos: id, sucursal_id, cuenta_id(nullable), categoria_gasto_id, concepto_gasto_id, tipo, monto, fecha_utc(DATE), mes_contable(DATE), fecha_vencimiento(DATE, nullable, agregado 29/07 — solo referencia, ver regla abajo), entidad_tipo_id, entidad_id, origen_tipo, origen_id, origen_subtipo(TEXT, sesión 15 — 'mercaderia'|'flete'), estado_cobro_id(sin usar — verificado 30/07, siempre NULL, no confundir con el modelo de `obligaciones`), medio_pago_id, turno_id, usuario_id, observaciones, anulado, creado_en
- Compras: categoria_gasto_id=1, concepto_gasto_id=33 | Flete: concepto_gasto_id=44
- Caja ingreso: categoria_gasto_id=13, concepto_gasto_id=43 | Caja retiro: categoria_gasto_id=13, concepto_gasto_id=41
- **Distinguir movimientos del mismo origen (ej. mercadería vs flete de una orden) usar SIEMPRE `origen_subtipo`, nunca texto libre en `observaciones`.**
- **`mes_contable` SIEMPRE sigue al mes de `fecha_utc` (caja real) — NUNCA al "Período" que carga el formulario.** El campo "Período" (`MovimientoForm.tsx`) es solo una etiqueta de referencia para saber a qué mes corresponde un pago atrasado (ej. impuesto de junio pagado en julio) — no mueve un peso de mes en Dashboard/Reportes. Error real cometido y corregido el 29/07: se había hecho que `mes_contable` siguiera al Período, descuadrando julio en +$1,9M.
- Categoría "Caja" (Ingreso/Retiro) oculta los campos Período y Fecha de vencimiento en el formulario — no son gastos con período propio.
- **Validación (29/07):** un movimiento en Efectivo se bloquea si no hay `cierres_turno` con `estado_cierre_turno_id=1` (turno abierto) — si no, ese efectivo real nunca se sumaría a ninguna conciliación de caja.

### Obligaciones (cuenta corriente por acreedor — sesión 29/07)
- acreedores: id, nombre, categoria_gasto_id(FK categorias_gasto — agrupa visualmente, no filtra conceptos), activo, creado_en
- acreedor_conceptos: acreedor_id, concepto_gasto_id (PK compuesta) — tabla puente; QUÉ conceptos puede usar cada acreedor. NO alcanza con filtrar por categoría del acreedor (ej. "Servicios" tiene 5 conceptos pero un acreedor puntual solo usa 1) — SIEMPRE unir por esta tabla, nunca por categoria_gasto_id directo.
- obligaciones: id, acreedor_id, categoria_gasto_id, concepto_gasto_id, tipo('Cargo'|'Pago'), monto, periodo(DATE, solo Cargo, referencia), fecha_vencimiento(solo Cargo), numero_comprobante, fecha_pago(solo Pago), medio_pago_id(solo Pago), movimiento_id(FK movimientos, solo Pago — se completa recién al pagar), observaciones, usuario_id, anulado, creado_en
- **Saldo de un acreedor = SUM(Cargo) - SUM(Pago), calculado siempre al vuelo — nunca se guarda ni cachea.**
- Un "Pago" en Obligaciones SIEMPRE debe generar (o enlazar a) una fila real en `movimientos` — nunca insertar un Pago sin `movimiento_id`.
- 16 acreedores cargados: Agustín Chandía, Fabiana, AFIP, FAECYS, INACAP, OSECAC, Sindicato, Juan Fernando Arévalo (Contador), Aguas Rionegrinas, Camuzzi Gas, Edersa, Alquiler, Claro, Canva, Empretienda, TusFacturasAPP.
- Categoría nueva: `Profesionales`. Conceptos nuevos: `Honorarios Contador`, `SAC` (separado de `Sueldo`, se paga en junio/diciembre).
- 3 conceptos renombrados para coincidir con el nombre del acreedor real: `Agua`→`Aguas Rionegrinas`, `Gas Camuzzi`→`Camuzzi Gas`, `Luz EDERSA`→`Edersa`.
- Insumos (Artículos de limpieza, Bolsas/Packaging) decidido explícitamente que NO entran en Obligaciones — no tienen proveedor fijo.

### Cuenta Corriente de Clientes (sesión 15/08 — espejo de Obligaciones, en sentido inverso)
- cliente_cobros: id, cliente_id(FK clientes), monto, fecha_cobro, medio_pago_id(FK medios_pago — SIEMPRE el medio real recibido, nunca "Cuenta Corriente"), movimiento_id(FK movimientos — SIEMPRE se genera/enlaza, igual que Obligaciones), observaciones, usuario_id, anulado, creado_en
- **Cargo = automático**, derivado de `venta_pagos` con `medio_pago_id` = id de "Cuenta Corriente" en `medios_pago` — NO se guarda en ninguna tabla, se calcula al vuelo en la pantalla cruzando `ventas`+`venta_pagos` de los clientes con `tiene_cuenta_corriente=true`.
- **Cobro = manual** (total o parcial) — SIEMPRE genera (o enlaza) una fila real en `movimientos`, mismo criterio que Obligaciones.
- Medio de pago "Cuenta Corriente": `fiscaliza_por_defecto=false`. **CRÍTICO:** `api/ventas/route.ts` excluye explícitamente los pagos con este medio del cálculo del movimiento financiero de la venta — si no se excluyera, se duplicaría el ingreso (una vez ficticio al vender, otra vez real al cobrar). Ver comentario "FIX (15/08/2026)" en ese archivo antes de tocar esa sección.
- Concepto de gasto "Cobro Cuenta Corriente" bajo categoría "Ventas" (`categoria_gasto_id=10`).
- `ventas_borrador.cliente_id` — columna que ya existía sin usarse, ahora se lee/escribe desde `ventas/page.tsx` (guardar borrador, restaurar borrador, cargar por `?borrador=X`).

### Presupuestos (sesión 15/08)
- presupuestos: id, numero(desde secuencia `numeracion_presupuestos`, vía rpc `incrementar_numero_presupuesto()`), cliente_id(FK clientes), estado(CHECK: Borrador/Enviado/Aprobado/Rechazado/Vencido/Convertido), fecha, validez_hasta, forma_pago, observaciones, subtotal, total, venta_borrador_id(FK ventas_borrador — se completa al Aprobar y enviar), venta_id(FK ventas — se completa a mano cuando esa venta se confirma de verdad), usuario_id, creado_en
- presupuesto_items: id, presupuesto_id(FK, ON DELETE CASCADE), articulo_id, cantidad, precio_unitario, subtotal, creado_en
- Reemplazo completo de ítems al editar (delete + insert) — seguro SOLO mientras `estado` es Borrador/Enviado (nunca tocó stock/movimientos reales en esos estados).
- Faltante de compra (dato interno, no persiste en tabla) = `cantidad presupuestada − stock_actual − cantidad en orden_compra_items de OC con estado_orden_compra_id=1 (Borrador)`, filtrado solo a los artículos del presupuesto.
- PDF generado client-side con `jsPDF` + `jspdf-autotable` (sin pasar por el servidor) — no confundir con el PDF de facturas, que viene de TusFacturasAPP.

### Remitos (sesión 15/08)
- remitos: id, numero(desde secuencia `numeracion_remitos`, vía rpc `incrementar_numero_remito()`), venta_id(FK ventas), fecha, observaciones, usuario_id, creado_en
- NO guarda copia de ítems — el PDF se arma leyendo `venta_items` en vivo al generarlo, nunca desactualizable.
- NO requiere CAE/ARCA — el remito de entrega entre privados no es documento fiscal (confirmado con RG 1415 AFIP: la Factura se emite en el momento de la entrega, el remito es solo respaldo de la entrega física, con firma de quien recibe).
- Reutiliza el mismo número si se vuelve a generar para la misma venta (mismo criterio que Fiscalización/Nota de Crédito).

### Stock
- articulo_stock: id, articulo_id, sucursal_id, stock_actual, stock_min, stock_max, actualizado_en
- movimientos_stock: id, sucursal_id, tipo_movimiento_stock_id, subtipo_movimiento_stock_id, deportista_id, usuario_id, observaciones, fecha_utc(TIMESTAMPTZ en prod), creado_en + columnas legacy nullable: articulo_id, estado_movimiento_stock_id, cantidad, sucursal_destino_id, origen_tipo, origen_id
- movimiento_stock_items: id, movimiento_stock_id, articulo_id, cantidad, creado_en
- tipos_movimiento_stock: 1=Ingreso, 2=Egreso, 3=Transferencia, 5=Ajuste
- subtipos_movimiento_stock: 1=Consumo interno, 2=Merma, 3=Sponsoreo

### Compras
- proveedores: id, nombre_comercial(NO nombre), cuit, razon_social, domicilio, cbu_alias, telefono, email, notas, activo, creado_en
- ordenes_compra: id, numero_orden, proveedor_id, sucursal_id, deposito_id, usuario_id, tipo_orden_compra_id, estado_orden_compra_id, tiene_comprobante, numero_factura_proveedor, numero_remito_proveedor, numero_pedido_externo, fecha_factura, fecha_remito, fecha_orden, descuento_pct, medio_pago_id, flete_monto, flete_fecha, flete_medio_pago_id, flete_transportista_id, monto_comprobante, subtotal, total, observaciones, creado_en
- orden_compra_items: id, orden_compra_id, articulo_id(nullable — sesión 15), cantidad_facturada, cantidad_recibida, precio_unitario_sin_iva, descuento_pct(NUMERIC NOT NULL DEFAULT 0 — **bug real corregido 28/07**: la columna existía pero nunca se leía en el SELECT ni se escribía en el INSERT de `compras/nueva/page.tsx` y `compras/[id]/page.tsx`; afectó a toda orden cargada con descuento desde que existe la pantalla), flete_prorrateado, costo_final_unitario, subtotal, es_ajuste_redondeo(BOOLEAN, sesión 15), creado_en
- **Lógica de movimientos (sesión 15):** el movimiento de mercadería y de flete se generan al GUARDAR la orden (Borrador o Confirmada), no solo al Confirmar — disparado por monto>0 en cada campo. Se distinguen por `movimientos.origen_subtipo` ('mercaderia'|'flete'), NUNCA por texto en observaciones. Stock/costo/historico_precios solo se tocan al Confirmar.
- **`sincronizarMovimiento()` mantiene UNA SOLA fila por orden+subtipo** — si se edita una orden que ya generó su movimiento (ej. el pedido creció de precio después de guardado), la función actualiza esa misma fila al monto nuevo con la fecha original de la orden, NO crea una segunda fila. Si en la vida real hubo dos pagos reales en fechas distintas para la misma orden, esto es una simplificación consciente (no rompe conciliación de caja si es transferencia, ni el total mensual si cae en el mismo mes) — partir en dos filas reales es frágil porque la próxima edición de la misma orden las volvería a colapsar en una.
- **Validación de comprobante (sesión 15):** campo `monto_comprobante` en la orden; diferencia ≥$500 bloquea guardado; diferencia <$500 ofrece ajuste automático que inserta un ítem `es_ajuste_redondeo=true` en `orden_compra_items` (nunca ajustar el precio unitario de un artículo real para forzar el cierre).

### Usuarios
- usuarios: id(UUID), dni_cuit, rol_id, sucursal_id, estado_usuario_id, creado_en, nombre, apellido, email — NO nombre_completo
- roles: 1=Admin, 2=Encargado

### Caja
- cierres_turno: id, sucursal_id, turno_id, usuario_id, estado_cierre_turno_id, fecha(DATE), apertura, apertura_contada, diferencia_apertura, ingresos_sistema, egresos_sistema, resultado_sistema, efectivo_real, diferencia, observaciones, creado_en, cerrado_en, cantidad_reaperturas — estados: 1=Abierto, 2=Sin diferencia, 3=Con diferencia
- retiros_caja: id, cierre_turno_id, usuario_id, monto, concepto, fecha_utc(TIMESTAMPTZ en prod), creado_en, sucursal_id
- turnos: 1=Mañana, 2=Tarde
- reaperturas_caja: id, cierre_turno_id, usuario_id, snapshot_antes(JSONB), snapshot_despues(JSONB), motivo, creado_en

### Deportistas
- deportes: id, nombre, activo, creado_en
- deportistas: id, nombre, apellido, dni, telefono, email, deporte(texto legacy), activo, creado_en, deporte_id(FK)

## Funciones PostgreSQL en producción
- get_rol_usuario() → BIGINT
- incrementar_numero_venta(p_sucursal_id BIGINT) → BIGINT — UPDATE numeracion_ventas SET ultimo_numero = ultimo_numero + 1 WHERE id = 1
- eliminar_movimiento_stock(p_movimiento_id BIGINT) → VOID
- editar_movimiento_stock(p_movimiento_id, p_subtipo_id, p_deportista_id, p_observaciones, p_items JSONB) → VOID
- abrir_turno(p_sucursal_id, p_turno_id, p_usuario_id) → BIGINT
- cerrar_turno(p_cierre_id, p_efectivo_real, p_observaciones) → VOID — setea cerrado_en = now()
- registrar_retiro_caja(p_cierre_turno_id, p_monto, p_usuario_id, p_concepto) → BIGINT
- reabrir_ultimo_cierre: NO existe en producción

## Vista
- articulos_sin_costo → articulos SIN costo_sin_iva (para Encargado)

## Datos de referencia producción
- Secuencias: ventas=1320, comprobantes=386 (ajustar a último número real de Cover el 06/07)
- articulos: 486 cargados (120 disponibles local, 119 sin precio, 127 con stock)
- 5 artículos sin código de barra pendientes

## Reglas de negocio
- Encargado NUNCA ve costos — usar vista articulos_sin_costo
- fiscalizar: pagos.some(p => p.fiscaliza === true)
- articulo_stock: siempre sucursal_id=1; query separada + merge por Map
- Toda la UI dice "ARCA" (no AFIP)
- QR Mercado Pago = medio_pago_id=5, emisor_pago_id=7
- Ventas fiscalizadas en Cover durante período paralelo = estado_venta_id=4

## Lo que NO debe hacer Claude Code
- NO asumir columnas sin verificar con SELECT en producción primero
- NO usar joins anidados en Supabase — query separada + merge por Map
- NO olvidar RLS + GRANT + GRANT ON SEQUENCE al crear tablas
- NO usar `&&` en PowerShell — usar `;`
- NO usar CSS :focus para botones activos — usar clases React por estado
- NO usar type="number" para inputs de monto
- NO usar nombre_completo en usuarios
- NO usar stock_minimo/stock_maximo — son stock_min/stock_max
- NO poner articulo_id/cantidad directamente en movimientos_stock — usar movimiento_stock_items
- NO usar middleware.ts — es proxy.ts en Next.js 16
- NO distinguir movimientos de un mismo origen por texto en observaciones — usar columna `origen_subtipo`
- NO ajustar precios unitarios de artículos reales para forzar que un total cierre — usar un ítem de ajuste separado (`es_ajuste_redondeo`)
- NO asumir que una tabla nueva tiene las 4 políticas RLS solo porque tiene SELECT — verificar INSERT/UPDATE/DELETE explícitamente
- NO asumir que una tabla VIEJA/preexistente tiene RLS+GRANT completos solo por ya estar en producción — verificar antes de sumarle un JOIN nuevo (rompió producción el 27/07 con `condiciones_iva`/`localidades`/`tipos_cliente`)
- NO hacer que `mes_contable` de `movimientos` siga a un campo distinto de `fecha_utc` — siempre es caja real, "Período" es solo referencia
- NO insertar un "Pago" en `obligaciones` sin un `movimiento_id` real enlazado — siempre generar (o enlazar a) una fila real de `movimientos`
- NO filtrar los conceptos disponibles de un acreedor por su `categoria_gasto_id` — usar siempre la tabla puente `acreedor_conceptos`
- NO generar movimiento financiero en `api/ventas/route.ts` para pagos con medio "Cuenta Corriente" — no es plata real, duplicaría el ingreso cuando se cobre de verdad
- NO asumir que `ventas_borrador.cliente_id` no existe o no se usa — se agregó/lee desde el 15/08, versiones previas del código no la leían
- NO usar `nombre_base` para mostrar el nombre de un artículo en listados/reportes — usar siempre `articulos.nombre` (el que arma el trigger con sabor incluido); `nombre_base` no distingue sabores y agrupa por error variantes distintas
- NO guardar copia de ítems en `remitos` — leer siempre `venta_items` en vivo al generar el PDF

## Errores críticos aprendidos
1. Joins anidados bloqueados por RLS — siempre query separada + merge por Map
2. RLS sin GRANT bloquea todo — RLS + políticas + GRANT siempre juntos
3. Sequences necesitan GRANT — `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated`
4. SELECT INTO en PL/pgSQL pisa valores iniciales — `variable := COALESCE(variable, fallback)` después del SELECT INTO
5. fecha_utc debe ser DATE no TIMESTAMPTZ — `.substring(0,10)` antes de mostrar o comparar
6. cerrar_turno debe setear cerrado_en — sin esto abrir_turno siguiente no encuentra el cierre
7. Nombres de funciones deben coincidir SQL↔código — verificar nombre exacto
8. CSS :focus no confiable en tablets — usar clases React basadas en estado
9. Schema cache de Supabase: `SELECT pg_notify('pgrst', 'reload schema')` después de ALTER TABLE
10. Sandbox y producción divergen silenciosamente — fuente de verdad es SELECT en producción, no los SQLs
11. precio_local en ArticuloForm: usar `?? 0` no `|| null` — null viola NOT NULL constraint
12. RLS con solo política SELECT bloquea silenciosamente INSERT/UPDATE/DELETE — error genérico "row-level security policy" sin decir qué falta; siempre verificar las 4 políticas (SELECT/INSERT/UPDATE/DELETE) al crear o tocar una tabla nueva
13. Nunca distinguir movimientos del mismo origen por texto en `observaciones` — usar columna dedicada (`origen_subtipo`), el texto libre es frágil para queries y auditoría
14. Al entregar dos archivos con el mismo nombre final (`page.tsx` en carpetas distintas de Next.js), nombrar los archivos de descarga de forma bien diferenciada (ej. `PARA_CARPETA_nueva.tsx` / `PARA_CARPETA_id_corchetes.tsx`) — de lo contrario el usuario puede confundir cuál va en cada carpeta al copiar/pegar manualmente
15. Nunca ajustar el precio unitario de un artículo real para forzar que un total cierre exacto contra un comprobante — el ajuste de redondeo debe ser un ítem separado y visible, no una alteración silenciosa del precio real del producto
16. Movimientos financieros generados por una Orden de Compra deben dispararse por `monto > 0` en el guardado (Borrador o Confirmada), no solo al Confirmar — de lo contrario la caja real queda desalineada del sistema durante todo el tiempo que la orden permanece sin confirmar
17. Una secuencia de Postgres puede desincronizarse del `MAX(id)` real de una tabla si en algún momento se insertó una fila con `id` puesto a mano — el síntoma es `duplicate key value violates unique constraint` al hacer un INSERT normal. Fix: `SELECT setval(pg_get_serial_sequence('tabla','id'), (SELECT MAX(id) FROM tabla));` antes de reintentar el INSERT
18. `numeracion_comprobantes.ultimo_numero` no se entera solo si se emite una factura real a mano por el portal web de TusFacturasAPP en vez de por la API — corregir con `UPDATE` puntual antes de la próxima fiscalización por sistema, o pide un número ya usado ante ARCA
19. Tablas viejas/preexistentes pueden no tener RLS+GRANT completos aunque ya estén en producción hace tiempo — el 27/07 un `JOIN` nuevo a `condiciones_iva`/`localidades`/`tipos_cliente` rompió la fiscalización automática porque nadie las había consultado desde el pipeline antes; verificar SIEMPRE, no solo en tablas recién creadas
20. Confundir "Período" (etiqueta de referencia) con "mes_contable" (lo que alimenta Dashboard/Reportes) descuadra los totales mensuales de forma silenciosa — `mes_contable` debe seguir SIEMPRE a `fecha_utc` (caja real), nunca a un campo editable aparte
21. Al mandar el mismo archivo de descarga varias veces en una sesión larga con el mismo nombre, el navegador puede guardar copias numeradas o el usuario puede mover una versión vieja sin darse cuenta — si `git status`/`git commit` dice "nothing to commit" después de un `Move-Item` que se esperaba con cambios, verificar el contenido real del archivo local (`Select-String -Pattern "algo_distintivo_del_cambio"`) antes de asumir que el deploy está mal
22. Un medio de pago que no representa plata real (ej. "Cuenta Corriente") debe excluirse explícitamente de cualquier cálculo que alimente `movimientos` — no alcanza con que el medio no fiscalice por defecto, hay que sacarlo a mano del loop que genera el Ingreso/Egreso, o se duplica la plata contada dos veces (venta + cobro)
23. Un ID de Postgres puede saltear números aunque no se haya borrado nada — si un `INSERT` falla después de que la secuencia ya entregó el próximo valor, ese número queda salteado para siempre (comportamiento normal, no bug ni pérdida de datos)
24. El remito de entrega entre privados NO requiere CAE/ARCA — solo la Factura es el documento fiscal (RG 1415, AFIP: la Factura se emite en el momento de la entrega de la mercadería, no cuando se cobra; el plazo de cta cte es una condición comercial que no mueve el momento fiscal)
