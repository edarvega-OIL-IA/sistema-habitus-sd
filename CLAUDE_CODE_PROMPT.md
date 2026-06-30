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
  compras/page.tsx
  compras/nueva/page.tsx
  compras/[id]/page.tsx
  movimientos/page.tsx
  movimientos/nuevo/page.tsx
  stock/page.tsx
  stock/nuevo/page.tsx
  stock/[id]/page.tsx
  cierre-turno/page.tsx
  reportes/page.tsx
  configuracion/page.tsx

src/components/ventas/PanelPagos.tsx
src/components/articulos/ArticuloForm.tsx
src/components/stock/MovimientoStockForm.tsx
src/app/api/ventas/route.ts
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

## FUENTE DE VERDAD DE BD — producción al 29/06/2026
**REGLA: Nunca documentar columnas sin verificar con SELECT en producción.**

### Catálogo
- articulos: id, nombre, nombre_base, rubro_id(nullable), marca_id(nullable), codigo_interno, codigo_barra, sku, unidad_medida_id, costo_sin_iva, tasa_iva_id, precio_local, precio_web, precio_mayorista, precio_oferta_web, disponible_local, disponible_web, visible_en_tienda, id_producto_web, id_stock_web, atributo_nombre, atributo_valor, peso_kg, descripcion, id_migracion, activo, creado_en, actualizado_en
- rubros: id, nombre, activo, creado_en — ids 1-19, 22, 23
- marcas: id, nombre, activo, creado_en — ids 1-16, 18, 20-41
- unidades_medida: id, nombre, abreviatura, creado_en — Unidad=4, Pack=5, Caja=6
- tasas_iva: id, nombre, porcentaje, activo, creado_en — 21%=4, 10.5%=5, 0%=6

### Ventas y pagos
- ventas: id, numero_venta, cliente_id, sucursal_id, usuario_id, estado_venta_id, descuento_pct, recargo_pct, subtotal, total, observaciones, fecha_utc(DATE), creado_en, cierre_turno_id, mes_contable
- venta_items: id, venta_id, articulo_id, cantidad, precio_unitario, descuento_pct, subtotal, creado_en
- venta_pagos: id, venta_id, medio_pago_id, monto, tarjeta_id, cupon, numero_autorizacion, cuenta_bancaria_id, referencia, creado_en, emisor_pago_id, payment_method_raw
- medios_pago: id, nombre, fiscaliza_por_defecto, activo, creado_en — Efectivo=1, Débito=2, Crédito=3, Transferencia=4, QR Mercado Pago=5
- emisores_pago: id, nombre, fiscaliza, activo, creado_en — Mercado Pago=7
- estados_venta: id, nombre — 1=Pendiente fiscal, 2=Guardada, 3=Anulada, 4=Fiscalizada

### Movimientos financieros
- categorias_gasto: id, nombre, tipo(Ingreso/Egreso/Ambos/Sistema), creado_en — NO tiene activo
- conceptos_gasto: id, categoria_gasto_id, nombre, tipo, creado_en
- movimientos: id, sucursal_id, cuenta_id(nullable), categoria_gasto_id, concepto_gasto_id, tipo, monto, fecha_utc(DATE), mes_contable(DATE), entidad_tipo_id, entidad_id, origen_tipo, origen_id, estado_cobro_id, medio_pago_id, turno_id, usuario_id, observaciones, anulado, creado_en
- Compras: categoria_gasto_id=1, concepto_gasto_id=33 | Flete: concepto_gasto_id=44
- Caja ingreso: categoria_gasto_id=13, concepto_gasto_id=43 | Caja retiro: concepto_gasto_id=41

### Stock
- articulo_stock: id, articulo_id, sucursal_id, stock_actual, stock_min, stock_max, actualizado_en
- movimientos_stock: id, sucursal_id, tipo_movimiento_stock_id, subtipo_movimiento_stock_id, deportista_id, usuario_id, observaciones, fecha_utc(TIMESTAMPTZ en prod), creado_en + columnas legacy nullable: articulo_id, estado_movimiento_stock_id, cantidad, sucursal_destino_id, origen_tipo, origen_id
- movimiento_stock_items: id, movimiento_stock_id, articulo_id, cantidad, creado_en
- tipos_movimiento_stock: 1=Ingreso, 2=Egreso, 3=Transferencia, 5=Ajuste
- subtipos_movimiento_stock: 1=Consumo interno, 2=Merma, 3=Sponsoreo

### Compras
- proveedores: id, nombre_comercial(NO nombre), cuit, razon_social, domicilio, cbu_alias, telefono, email, notas, activo, creado_en
- ordenes_compra: id, numero_orden, proveedor_id, sucursal_id, deposito_id, usuario_id, tipo_orden_compra_id, estado_orden_compra_id, tiene_comprobante, numero_factura_proveedor, numero_remito_proveedor, numero_pedido_externo, fecha_factura, fecha_remito, fecha_orden, descuento_pct, flete_monto, flete_medio_pago_id, flete_transportista_id, subtotal, total, observaciones, creado_en
- orden_compra_items: id, orden_compra_id, articulo_id, cantidad_facturada, cantidad_recibida, precio_unitario_sin_iva, flete_prorrateado, costo_final_unitario, subtotal, creado_en

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
