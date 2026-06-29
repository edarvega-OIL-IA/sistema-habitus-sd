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

## Stack
- Next.js 16 (App Router) + TypeScript
- Supabase (PostgreSQL + RLS + Auth)
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- Tipografía: Inter (Google Fonts) — configurada en layout.tsx como --font-sans

## Colores de marca (usar siempre)
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

src/components/layout/
  Sidebar.tsx (ya completo)
  Header.tsx (ya completo)

src/components/ventas/
  BuscadorProductos.tsx (ya completo)
  CarritoItems.tsx (ya completo)
  PanelPagos.tsx (ya completo)

src/components/articulos/
  ArticuloForm.tsx (ya completo)

src/components/stock/
  MovimientoStockForm.tsx (ya completo)

src/app/api/ventas/route.ts (ya completo)

src/lib/supabase/
  client.ts (ya completo)
  server.ts (ya completo)

src/proxy.ts (ya completo — reemplaza middleware.ts en Next.js 16)

## Patrones establecidos
- Server Components para queries a Supabase
- Client Components solo cuando hay interactividad
- Siempre usar createClient() desde @/lib/supabase/server en Server Components
- Siempre usar createClient() desde @/lib/supabase/client en Client Components
- Filtrado siempre en cliente (load-all + filter) — evita race conditions
- Queries separadas + merge por Map para relaciones con RLS (nunca join anidado profundo)

## Reglas de UI (NO modificar)
- Buscador para agregar items SIEMPRE arriba de la lista
- Campo búsqueda POS: autofocus permanente + texto siempre seleccionado
- Navegación ↑↓ + Enter en lista de resultados del buscador
- Búsqueda tokenizada: "creat ena" filtra artículos que contienen ambas palabras en cualquier campo
- Teclas rápidas: Ctrl+F fiscalizar, Ctrl+G guardar, Ctrl+D descuento, Ctrl+P pago, Ctrl+B buscador, Ctrl+X cancelar
- Popup cantidad POS: confirma con Enter, lectura otro código, o 2 seg sin actividad
- Panel derecho POS se opera con mouse; teclado exclusivo del panel izquierdo
- Botones Fiscalizar/Guardar: el activo se pinta verde (#00a19a) por estado React, NO por CSS focus
- Foco automático: pendiente=$0 + fiscaliza → Fiscalizar; pendiente=$0 + no fiscaliza → Guardar
- Descuento: campo único con toggle %/$ (botón al lado del campo)
- Notificaciones de error: diseño del sistema (div rojo/verde con X), NO alert()
- Al agregar artículo en compras: foco va a Cant.Fact. con select; Enter vuelve al buscador

## Inputs numéricos — REGLA CRÍTICA
- NUNCA usar type="number" para montos — usar type="text" inputMode="numeric"
- Cantidades enteras (cant_facturada, cant_recibida, cantidad de stock) pueden usar type="number"
- Para React Hook Form con montos: usar setValueAs en lugar de valueAsNumber: true
- Parseo: parseFloat(v.replace(/\./g,'').replace(',','.')) || 0
- Display: n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

## Tablas principales en Supabase — CAMPOS REALES VERIFICADOS (producción al 29/06/2026)

### Catálogo
- articulos (id, nombre, nombre_base, rubro_id, marca_id, codigo_interno, codigo_barra, sku, unidad_medida_id, costo_sin_iva, tasa_iva_id, precio_local, precio_web, precio_mayorista, precio_oferta_web, disponible_local, disponible_web, visible_en_tienda, atributo_nombre, atributo_valor, peso_kg, descripcion, id_migracion, id_producto_web, id_stock_web, activo, creado_en, actualizado_en) — marca_id y rubro_id son nullable
- rubros (id, nombre, activo) — ids 1-19, 22, 23
- marcas (id, nombre, activo) — ids 1-16, 18, 20-41
- unidades_medida (id, nombre, abreviatura) — id 4=Unidad, 5=Pack, 6=Caja
- tasas_iva (id, nombre, porcentaje, activo, creado_en) — campo es nombre, NO descripcion; id 4=21%, 5=10.5%, 6=0%

### Proveedores y compras
- proveedores (id, nombre_comercial, cuit, razon_social, domicilio, cbu_alias, telefono, email, notas, activo, creado_en) — campo es nombre_comercial, NO nombre
- transportistas (id, nombre, activo)
- ordenes_compra (id, numero_orden, proveedor_id, sucursal_id, deposito_id, usuario_id, tipo_orden_compra_id, estado_orden_compra_id, tiene_comprobante, numero_factura_proveedor, numero_remito_proveedor, numero_pedido_externo, fecha_factura, fecha_remito, fecha_orden, descuento_pct, flete_monto, flete_medio_pago_id, flete_transportista_id, subtotal, total, observaciones, creado_en)
- estados_orden_compra (id, nombre) — 1=Borrador, 2=Confirmada, 3=Anulada
- tipos_orden_compra (id, nombre) — 1=Rápida, 2=Completa
- orden_compra_items (id, orden_compra_id, articulo_id, cantidad_facturada, cantidad_recibida, precio_unitario_sin_iva, flete_prorrateado, costo_final_unitario, subtotal, creado_en)
- historico_precios (id, articulo_id, fecha, tipo, costo_sin_iva, precio_local, precio_web, precio_mayorista, precio_oferta_web, tasa_iva_id, origen_id, usuario_id, creado_en)

### Ventas y pagos
- ventas (id, numero_venta, cliente_id, sucursal_id, usuario_id, estado_venta_id, descuento_pct, subtotal, total, observaciones, fecha_utc, cierre_turno_id, mes_contable, creado_en)
- venta_items (id, venta_id, articulo_id, cantidad, precio_unitario, descuento_pct, subtotal)
- venta_pagos (id, venta_id, medio_pago_id, emisor_pago_id, monto, referencia, payment_method_raw, creado_en)
- medios_pago (id, nombre, fiscaliza_por_defecto, activo) — 1=Efectivo, 2=Débito, 3=Crédito, 4=Transferencia
- emisores_pago (id, nombre, fiscaliza, activo, creado_en)
- estados_venta (id, nombre) — 1=Pendiente fiscal, 2=Guardada, 3=Anulada
- comprobantes (id, venta_id, tipo_comprobante_id, punto_venta_id, estado_fiscal_id, fecha_emision_utc, total, fiscalizacion_intentos, impreso_enviado)

### Movimientos financieros
- categorias_gasto (id, nombre, tipo, creado_en) — tipo: Ingreso/Egreso/Ambos/Sistema; NO tiene campo activo
- conceptos_gasto (id, categoria_gasto_id, nombre, tipo, creado_en)
- movimientos (id, sucursal_id, cuenta_id, categoria_gasto_id, concepto_gasto_id, tipo, monto, fecha_utc, mes_contable, entidad_tipo_id, entidad_id, origen_tipo, origen_id, estado_cobro_id, medio_pago_id, turno_id, usuario_id, observaciones, anulado, creado_en) — fecha_utc es DATE; cuenta_id nullable
- Compras mercadería: categoria_gasto_id=1, concepto_gasto_id=33
- Flete compra: concepto_gasto_id=44
- Caja ingreso: categoria_gasto_id=13, concepto_gasto_id=43
- Caja retiro: categoria_gasto_id=13, concepto_gasto_id=41

### Stock
- articulo_stock (id, articulo_id, sucursal_id, stock_actual, stock_min, stock_max, actualizado_en)
- movimientos_stock (id, sucursal_id, tipo_movimiento_stock_id, subtipo_movimiento_stock_id, deportista_id, usuario_id, observaciones, fecha_utc, creado_en) — articulo_id/cantidad/estado_movimiento_stock_id nullable (columnas legacy)
- movimiento_stock_items (id, movimiento_stock_id, articulo_id, cantidad)
- tipos_movimiento_stock (id, nombre) — 1=Ingreso, 2=Egreso, 3=Transferencia, 5=Ajuste
- subtipos_movimiento_stock (id, tipo_movimiento_stock_id, nombre, activo) — 1=Consumo interno, 2=Merma, 3=Sponsoreo

### Usuarios y deportistas
- usuarios (id UUID, nombre, apellido, email, rol_id, sucursal_id, activo, estado_usuario_id)
- roles (id, nombre) — 1=Admin, 2=Encargado
- deportes (id, nombre, activo)
- deportistas (id, nombre, apellido, dni, telefono, email, deporte, deporte_id, activo, creado_en)

### Cierre de turno
- cierres_turno (id, sucursal_id, fecha, turno_id, usuario_id, apertura, apertura_contada, diferencia_apertura, ingresos_sistema, egresos_sistema, resultado_sistema, efectivo_real, diferencia, observaciones, cerrado_en, estado_cierre_turno_id, cantidad_reaperturas)
- retiros_caja (id, sucursal_id, fecha_utc, monto, usuario_id, observaciones, cierre_turno_id, concepto, creado_en)
- turnos (id, nombre) — 1=Mañana, 2=Tarde
- reaperturas_caja (id, cierre_turno_id, usuario_id, snapshot_antes, snapshot_despues, motivo, creado_en)

## Funciones PostgreSQL disponibles
- get_rol_usuario() → retorna rol_id del usuario autenticado
- incrementar_numero_venta(p_sucursal_id BIGINT) → BIGINT — nombre exacto que usa el código
- eliminar_movimiento_stock(p_movimiento_id BIGINT) → revierte stock + elimina items + cabecera
- editar_movimiento_stock(p_movimiento_id, p_subtipo_id, p_deportista_id, p_observaciones, p_items JSONB)
- abrir_turno(p_sucursal_id, p_turno_id, p_usuario_id) → BIGINT
- cerrar_turno(p_cierre_id, p_efectivo_real, p_observaciones) — setea cerrado_en = now()
- registrar_retiro_caja(p_cierre_turno_id, p_monto, p_usuario_id, p_concepto) → BIGINT
- reabrir_ultimo_cierre: NO existe en producción todavía

## Vista importante
- articulos_sin_costo → igual que articulos pero SIN columna costo_sin_iva (para Encargado)

## Reglas de negocio críticas
- Encargado NUNCA ve costos de artículos — usar vista articulos_sin_costo
- Precio de compra se ingresa CON IVA incluido; sistema divide por tasa antes de persistir
- Al confirmar compra: actualiza costo_sin_iva en articulos + inserta en historico_precios
- Al anular compra confirmada: revierte stock, restaura costo desde historico_precios, marca movimientos.anulado=true
- Fiscalización: debeFiscalizar = pagos.some(p => p.fiscaliza === true)
- La decisión final de fiscalizar la toma siempre el cajero (Ctrl+F o Ctrl+G)
- Numeración correlativa: función incrementar_numero_venta() — UPDATE...RETURNING atómico
- Movimientos se generan automáticamente por ventas y compras
- articulo_stock: siempre filtrar por sucursal_id=1; hacer query separada + merge por Map
- Toda la UI dice "ARCA" (no AFIP)
- Descuento en POS: campo único con toggle %/$
- 119 artículos tienen precio_local=0 y disponible_local=false — pendiente actualizar
- 5 artículos sin código de barra aún pendientes

## Datos de referencia producción (al 29/06/2026)
- rubros: 21 | marcas: 39 | unidades_medida: Unidad=4, Pack=5, Caja=6
- tasas_iva: 21%=4, 10.5%=5, 0%=6
- medios_pago: Efectivo=1, Débito=2, Crédito=3, Transferencia=4
- emisores_pago: 9 | proveedores: Black=1, Disfit=2, EPN=3, Vitatech=4
- transportistas: Andreani=1, Correo Argentino=2, VIA CARGO=3
- subtipos_movimiento_stock: Consumo interno=1, Merma=2, Sponsoreo=3
- deportes: 6 | deportistas: 8
- articulos: 486 cargados | Secuencias: ventas=1310, comprobantes=386

## Lo que NO debe hacer Claude Code
- NO cambiar la estructura de rutas
- NO cambiar los colores de marca
- NO agregar campos que no estén en el esquema verificado
- NO implementar lógica de fiscalización con AFIP todavía
- NO crear tablas nuevas sin consultar primero
- NO usar middleware.ts (en Next.js 16 se llama proxy.ts)
- NO asumir nombres de columnas — verificar siempre con SELECT * antes
- NO usar nombre_completo en usuarios
- NO usar stock_minimo/stock_maximo — son stock_min/stock_max
- NO usar type="number" para inputs de monto
- NO usar valueAsNumber: true en React Hook Form para montos
- NO hacer join anidado profundo en Supabase — query separada + merge por Map siempre
- NO poner articulo_id/cantidad directamente en movimientos_stock — usar movimiento_stock_items
- NO olvidar RLS + GRANT + GRANT ON SEQUENCE al crear tablas nuevas
- NO usar `&&` en PowerShell — usar `;`
- NO asumir que un cambio de esquema en sandbox existe en producción
- NO usar CSS :focus para el color de botones activos — usar clases React por estado

## Errores críticos aprendidos (no repetir)
1. **Joins anidados bloqueados por RLS** — siempre query separada + merge por Map
2. **RLS sin GRANT bloquea todo** — RLS + políticas + GRANT van siempre juntos
3. **Sequences necesitan GRANT explícito** — `GRANT USAGE, SELECT ON SEQUENCE nombre_seq TO authenticated`
4. **SELECT INTO en PL/pgSQL pisa valores iniciales** — siempre `variable := COALESCE(variable, fallback)` después del SELECT INTO
5. **Cambios de esquema sandbox → producción** — registrar inmediatamente en SQL
6. **fecha_utc debe ser DATE, no TIMESTAMPTZ** — `.split('-').reverse().join('/')` rompe con timestamps
7. **cerrar_turno debe setear cerrado_en** — sin esto abrir_turno siguiente no encuentra el cierre anterior
8. **Deploy con `npx vercel deploy --prod` no garantiza variables de entorno** — usar GitHub + Vercel automático
9. **`&&` no funciona en PowerShell** — usar `;`
10. **Nombres de funciones deben coincidir entre SQL y código** — el código llama `incrementar_numero_venta`, el SQL debe crearla con ese nombre exacto
11. **CSS :focus no es confiable en tablets** — los botones activos deben usar clases React basadas en estado, no `:focus`
