# Sistema Habitus SD — Documento de Análisis
**Versión:** Sesión 01 · 13/06/2026  
**Estado:** En análisis — sin código escrito aún  
**Próximo paso:** Continuar análisis (stack, fiscalización, ERD)

---

## 1. Negocio

| Campo | Valor |
|---|---|
| Nombre | Habitus SD (Suplementos Deportivos) |
| Local | Avenida Roca 54, Cinco Saltos, Río Negro, Patagonia |
| Tienda online | habitussd.com (Empretienda) |
| Email | habitus.sd@gmail.com |
| WhatsApp | +549 299 324 4332 |
| Sistema actual | coverweb.com.ar (abono mensual, acceso autorizado) |
| Régimen fiscal | Monotributista — no deduce IVA, emite facturas C |

---

## 2. Objetivo del sistema

Reemplazar coverweb.com.ar por un sistema web propio, más simple y unificado, que:
- Sincronice stock entre el local físico y habitussd.com
- Registre ventas con fiscalización
- Registre compras de forma simplificada (sin formalidad fiscal — por el momento; fiscalización de compras queda como mejora futura)
- Reemplace el excel de caja diaria
- Emita facturas electrónicas AFIP solo cuando el cliente lo pide
- Esté preparado para múltiples sucursales desde el día 1

**Política de desarrollo:** semana completa de análisis antes de escribir la primera línea de código.

---

## 3. Catálogo actual

| Dato | Local | Web |
|---|---|---|
| Total artículos | 488 | 369 |
| Con stock | 130 | 317 |
| Rubros | 21 | 20 |
| Marcas | 40 | — |

**Rubros principales:** Proteínas, Creatinas, Barras de proteína, Colágenos, Pre-entrenamiento, Aminoácidos, Quemadores, Salud y bienestar, Geles, Bebidas Isotónicas, Glutamina, Multivitamínicos, Óxido Nítrico, Pro Hormonal, Energía, Ganadores de peso, Sales, Foods, Proteínas Vegetales

**Marcas principales:** ENA, Star Nutrition, Gold Nutrition, Nutremax, Gentech, One Fit, Innovanaturals, Vita Tech, Body Advance, Ultra Tech, Xtrenght, Pulver, Mervick, GU Energy, Neix Reloaded

---

## 4. Módulos del sistema

### 4.1 Módulos confirmados (en orden de prioridad)

1. **Artículos / Inventario** — alta directa sin módulo de compras formal
2. **Órdenes de Compra** — simplificadas, sin exigencia fiscal, con flete redistribuido
3. **Movimientos de Stock** — ingreso / egreso / transferencia con estado
4. **Ventas** — carrito, medios de pago múltiples, fiscalización
5. **Caja / Gastos** — reemplaza el excel manual de movimientos diarios
6. **Facturación AFIP** — solo cuando el cliente lo pide (tipo C)
7. **Reportes** — básicos (ver sección 9)
8. **Sincronización Empretienda** — vía API (a confirmar)

### 4.2 Módulos excluidos

- Módulo de compras formal con datos fiscales obligatorios
- Cheques
- Transportistas / Rutas de viaje
- Retenciones automáticas de ganancias
- Multi-moneda activa (estructura en BD lista pero inactiva)
- Carro de compras a proveedores (flujo formal)
- Gestión completa de clientes (solo mínimo para emitir factura)

---

## 5. Arquitectura multi-sucursal

**Decisión clave:** diseñar para múltiples sucursales desde el día 1, aunque hoy haya una sola (Cinco Saltos).

- Stock en tabla separada: `articulo_stock (articulo_id, sucursal_id, stock_actual, stock_minimo, stock_maximo)`
- Precios: estructura por sucursal lista, hoy todos iguales
- Web: muestra disponibilidad por sucursal (referencia: PC Factory)
- Disponibilidad web: `en_stock` / `disponible_pronto` / `bajo_pedido` / `sin_stock` → tabla de referencia

---

## 6. Modelo de datos: Artículo

### Campos confirmados

**Identificación**
- `id`, `nombre`, `rubro_id` (FK), `marca_id` (FK), `codigo_interno`, `codigo_barra`, `sku`

**Precios**
- `costo_sin_iva`, `tasa_iva_id` (FK), `precio_local`, `precio_web` (default = precio_local), `precio_mayorista`, `precio_oferta_web`

**Disponibilidad**
- `disponible_local` (bool), `disponible_web` (bool), `visible_en_tienda` (bool)

**Stock** → en tabla separada `articulo_stock` por sucursal

**Datos web** (para sincronización con Empretienda)
- `id_producto_web`, `id_stock_web`, `atributo_nombre`, `atributo_valor`, `peso_kg`

**Extra**
- `descripcion`, `imagen`

### Reglas de negocio
- `precio_web` = `precio_local` por defecto; aviso visual cuando difieren
- Geles y barritas: `disponible_web = false` (solo se venden en local)
- Stock es único y se descuenta tanto en ventas del local como en pedidos web

### Campos de coverweb descartados
- Subrubro / Subcategoría, Fabricante, Modelo, Fórmula, Factor de conversión
- Ubicación (fila/módulo/nivel/posición), Colores, Matriz de medidas
- Imágenes 2 y 3, Palabras clave, Detalle envío

---

## 7. Ventas

### Flujo
`Carrito` → `Agregar artículos` → `Detalle con items` → `Pantalla de facturación` → `Medios de pago` → `Fiscalizar` o `Guardar`

### Medios de pago reales (tabla de referencia)
- Efectivo
- Mercado Pago QR
- Mercado Pago Débito
- Mercado Pago Crédito (Naranja, otras)
- Transferencia (alias: habitus.sd / camino.doce.doce / habitus.patagonia / doce.doce.delsur)
- Tarjeta Naranja (cuotas)
- Banco Patagonia
- OpenPay

**Nota:** una venta puede tener múltiples medios de pago simultáneos → tabla `venta_pagos` separada.

### Fiscalización
- Solo ventas cobradas con postnet / QR / tarjeta
- Punto de venta: 0003 - Principal (Electrónico)
- Pendiente confirmar: ¿controladora fiscal física o AFIP directo?

### Factura electrónica AFIP
- Solo cuando el cliente la pide explícitamente
- Tipo C (monotributista)
- Actualmente 1 solo cliente cargado
- Pendiente confirmar: proveedor de fiscalización AFIP/ARCA — candidato principal TusFacturasAPP (API REST homologada ARCA desde 2015), alternativas: Afip SDK, WSFEv1 directo. **Corrección (sesión 15): Facturama descartado por completo — es una plataforma exclusivamente mexicana (CFDI/SAT México), nunca sirvió para Argentina/AFIP-ARCA.**

### Otros campos relevantes de ventas
- Descuento y recargo por venta: sí
- Cheques: NO
- Vendedor: sí (para filtros en reportes)
- Punto de venta: sí

---

## 8. Órdenes de Compra

### Concepto
Registro simplificado de compras de mercadería, sin formalidad fiscal. El monotributista no deduce IVA, por lo que el registro es solo para control interno de costos y stock.

### Modo rápido (Black Suplementos, compras ocasionales)
- Proveedor + fecha + número de pedido externo (opcional)
- Artículos con cantidad recibida y precio unitario
- Descuento del proveedor (en $ o %)
- Flete (monto separado + medio de pago)
- Observaciones

### Modo completo (Disfit, EPN — cuando hay factura/remito)
- Todo lo anterior
- Número de factura o remito del proveedor
- Fecha de emisión y vencimiento
- Estos campos no afectan ningún cálculo fiscal, son solo para registro

### Flete
- Campo separado del monto de la compra
- Se redistribuye proporcionalmente entre los artículos del pedido para calcular costo real
- Puede tener medio de pago diferente al del pedido
- Black: cobra flete junto con la mercadería en la misma transferencia, pero el desglose es conocido

### Promociones de proveedor
- Tipo "12 unidades + 1 gratis" → campo `cantidad_recibida` separado de `cantidad_facturada`
- El costo unitario real se calcula sobre lo recibido

### Genera automáticamente
- Movimiento de stock tipo "Ingreso" al confirmar la orden
- Actualización de costo del artículo (con flete incluido)

---

## 9. Proveedores

### Campos (ninguno obligatorio excepto nombre_comercial)
`nombre_comercial`, `cuit`, `razon_social`, `domicilio`, `cbu_alias`, `telefono`, `email`, `notas`

### Proveedores actuales identificados

| Proveedor | Tipo | Canal de compra |
|---|---|---|
| Black Suplementos | Recurrente | WhatsApp / chat, transferencia |
| Disfit | Recurrente | Sistema web propio (coverweb) |
| EPN | Recurrente | Tienda web mayorista propia |
| Nutremax | Ocasional | — |
| Heffner | Puntual | — |
| Isaac, Roque, otros | Puntuales | — |

---

## 10. Caja / Gastos

Reemplaza el excel manual `CAJA_DIARIA_CINCO-SALTOS.xlsx` y `CAJA_DIARIA_HABITUS-SD_EAV.xlsx`.

### Campos
`sucursal_id`, `turno` (Mañana/Tarde/General), `encargado_id`, `mes_contable`, `fecha`, `categoria_id`, `concepto_id`, `proveedor_cliente`, `monto`, `estado_pago`, `medio_pago_id`, `alias_cuenta`, `observaciones`, `tipo` (Ingreso/Egreso)

### Categorías de gastos (tabla de referencia)
- Suplementos (compras de mercadería)
- Empleados (sueldos, adelantos, cargas sociales)
- Impuestos (AFIP, IIBB, municipalidad)
- Local Comercial (alquiler, mantenimiento)
- Marketing (publicidad, diseño, gráfica)
- Página Web (Empretienda, GoDaddy, Canva)
- Servicios (luz, gas, agua, internet, teléfono)
- Sistema (coverweb, otros)

### Conceptos frecuentes identificados
Alquiler, Luz EDERSA, Gas Camuzzi, Agua, Internet, Claro Celular Local, Sueldo Agustín, Sueldo Giuliano, Sueldo Ariel, Limpieza Fabiana, Faecys, OSECAC, INACAP, AFIP Monotributo, AFIP Rentas, Ingresos Brutos, Municipalidad, Publicidad Instagram, Coverweb, Empretienda, Transporte VIA CARGO, Mayorista (compras)

---

## 11. Tablas de referencia (todas desde el día 1)

Lección directa del sistema LNT: todo valor categórico va a una tabla de referencia, nunca hardcodeado.

| Tabla | Descripción |
|---|---|
| `sucursales` | Cinco Saltos (hoy), futuras |
| `rubros` | 21 categorías de artículos |
| `marcas` | 40 marcas de productos |
| `tasas_iva` | 0%, 10.5%, 21% |
| `medios_pago` | Efectivo, MP QR, Transferencia, etc. |
| `tipos_comprobante` | Factura, Ticket, Remito, etc. |
| `estados_venta` | Guardada, Fiscalizada, Anulada |
| `tipos_movimiento_stock` | Ingreso, Egreso, Transferencia |
| `estados_movimiento_stock` | Pendiente, Confirmado, Anulado |
| `estados_disponibilidad_web` | en_stock, disponible_pronto, bajo_pedido, sin_stock |
| `categorias_gasto` | Ver sección 10 |
| `conceptos_gasto` | Ver sección 10 |
| `puntos_venta` | 0003 Principal (Electrónico) |
| `unidades_medida` | Unidad, Pack, etc. |
| `monedas` | ARS (activa), USD (estructura lista) |
| `turnos` | Mañana, Tarde, General |

---

## 12. Reportes identificados

- **Compras y ventas de artículos** — filtros: fecha, artículo, rubro, marca, punto de venta, depósito, vendedor, tipo comprobante
- **Artículos en stock mínimo** — por sucursal
- **Movimientos de stock** — por período, tipo, artículo, depósito
- **Resumen de caja** — por período, categoría, concepto, medio de pago
- **Ventas por medio de pago** — para conciliación con extractos bancarios
- **Dashboard ejecutivo** — ventas del mes, promedio diario, meta mensual, punto de equilibrio (basado en excel GERENCIA_V3)

---

## 13. Lecciones del sistema LNT aplicadas

Del documento `lecciones-aprendidas-v2.txt` (24 sesiones de desarrollo previo):

1. **BD antes que código** — esquema completo definido antes de escribir la primera línea
2. **Todo categórico es tabla** — sin strings hardcodeados en ningún lado
3. **FK naming consistente** — siempre `tabla_destino_id`
4. **Timezone en UTC** — conversión solo en capa de presentación
5. **ESTADO-PROYECTO.md** — se crea en sesión 1, se actualiza al cierre de cada sesión
6. **Staging separado** — nunca datos reales en desarrollo
7. **RLS desde el día 1** — si se usa Supabase, todas las tablas con políticas para 4 verbos
8. **Multi-tenant desde el inicio** — aunque hoy sea un solo usuario
9. **Módulo financiero diseñado completo** — antes de implementar la primera línea
10. **Auditoría de seguridad antes del primer deploy** — no en sesión 10

---

## 14. Decisiones de diseño tomadas

- [ ] Stack tecnológico — **PENDIENTE**
- [x] Sistema web (no desktop)
- [x] Multi-sucursal en BD desde día 1
- [x] Formulario artículo en 5 secciones
- [x] Precio web = precio local por defecto con aviso visual si difieren
- [x] Stock en tabla separada por sucursal
- [x] Venta_pagos tabla separada (medios múltiples)
- [x] Órdenes de compra sin formalidad fiscal (modo rápido / modo completo)
- [x] Flete redistribuido proporcionalmente en costo de artículos
- [x] Proveedor: todos los campos opcionales excepto nombre_comercial
- [x] Tablas de referencia para todos los valores categóricos

---

## 15. Pendientes de confirmar

- [ ] **Stack tecnológico** (backend, frontend, base de datos, hosting)
- [ ] **Fiscalización**: ¿controladora fiscal física o AFIP directo?
- [ ] **Facturación**: ¿servicio propio o tercero (TusFacturasAPP, Afip SDK, WSFEv1 directo)? Facturama descartado (es mexicano, no sirve para Argentina).
- [ ] **API Empretienda**: ¿disponible en el plan actual?
- [ ] **Hosting / despliegue**
- [ ] **Reportes adicionales** que puedan surgir del análisis

---

## 16. Próximos pasos del análisis

1. Definir stack tecnológico
2. Confirmar tipo de fiscalización
3. Confirmar solución de facturación AFIP
4. Verificar API de Empretienda
5. Diseñar esquema completo de base de datos (ERD)
6. Crear ESTADO-PROYECTO.md
7. Definir convención de nombres de tablas y columnas
8. Mockups de pantallas principales (ventas, compras, caja)

---

*Documento generado al cierre Sesión 01 — Sistema Habitus SD*  
*Basado en análisis de: coverweb.com.ar, habitussd.com, excel caja diaria, pantallas del sistema actual, lecciones LNT*

---

## 17. Datos fiscales ARCA (ex AFIP) — confirmados

**CUIT:** 23-23890071-9  
**Régimen:** Monotributista  
**Actividad principal:** 476310 - Venta al por menor de equipos y artículos deportivos (desde 02/2026)  
**Actividad secundaria:** 960990 - Servicios Personales N.C.P.  
**Condición empleador:** Sí (Agustín, Giuliano, Fabiana)

### Puntos de venta registrados

| PV | Domicilio | Modo | Uso |
|---|---|---|---|
| 00003 | Av. Roca 54, Cinco Saltos | Factura Electrónica - Monotributo - **Web Services** | ✅ Ventas del local |
| 00002 | Ramos Meja y Padre Greber | Factuweb (Imprenta) - Monotributo | ❌ No se usa |

### Implicancias para el sistema

- **No hay controladora fiscal física** — todo es electrónico vía API
- **PV 00003 ya habilitado para Web Services** — el sistema propio puede conectarse directamente a AFIP sin trámites adicionales
- **Solo facturas C** — monotributista, sin IVA discriminado
- **Integración:** WSFE (Web Service de Facturación Electrónica de AFIP) — directa o vía servicio intermediario argentino homologado (TusFacturasAPP, Afip SDK, etc.) — Facturama descartado, es exclusivamente mexicano.
- **Pendiente decidir:** integración directa con AFIP vs servicio tercero

### Ahorro por reemplazar coverweb

| Período | Monto mensual |
|---|---|
| Enero 2025 | $138.500 |
| Mayo 2026 | $204.900 |
| Incremento 17 meses | +48% |

Hosting estimado sistema propio: ~$15.000-$25.000/mes → **ahorro neto ~$180.000/mes**

---

## 18. Reporte de Caja — flujo actual y diseño propuesto

### Flujo actual (a reemplazar)
1. Coverweb genera reporte de caja por turno (mañana 8-14 / tarde 17-21)
2. Encargado toma el total y lo carga manualmente en el excel de caja diaria
3. Excel consolida ventas + gastos + compras del día

### Flujo con el sistema nuevo
- El reporte de caja del sistema ES el excel — sin transcripción manual
- Al cierre de turno: el encargado ve el total de efectivo, lo confirma, queda registrado

### Estructura del reporte de caja
- **Filtros:** sucursal, turno, fecha desde/hasta, encargado, medio de pago, tipo (fiscal/guardado/completo)
- **Vista detalle:** cada venta/gasto del turno con tipo, comprobante, importe, cliente, forma de pago
- **Vista resumen:** totales por medio de pago (Efectivo, Tarjetas, Transferencia, etc.) + fiscal vs guardado + totales por vendedor
- **Exportable a Excel**

### Reportes del menú de coverweb identificados (para replicar los relevantes)
- Compras y Ventas de Artículos ✅ (ya definido)
- Reporte de Caja ✅ (ya definido)
- Listado de Artículos ✅ (básico)
- Reporte de Gestión (dashboard ejecutivo — basado en excel GERENCIA_V3)
- IVA y Retenciones ❌ (no aplica monotributista)
- Libro IVA Compras/Ventas ❌ (no aplica)
- Cuenta Corriente ❌ (no usás crédito con clientes)
- Saldos Consolidados ❌ (no aplica)

---

## 19. Usuarios y roles

### Usuarios actuales
| Usuario | Rol | Turno | Email |
|---|---|---|---|
| Ariel Vega | Admin / Dueño | Sábados, feriados, cobertura | habitus.sd@gmail.com |
| Agustín Chandia | Encargado | Lunes a viernes (mañana y tarde) | agustinchandiaok@gmail.com |

### Roles del sistema (tabla `roles`)

**Admin (Ariel):** acceso total — artículos, compras, caja, ventas, reportes, configuración, usuarios, precios, costos.

**Encargado (Agustín):**
- ✅ Ventas
- ✅ Caja (apertura/cierre turno, retiros)
- ✅ Stock (ver y registrar movimientos)
- ✅ Artículos (ver — sin costos, sin modificar precios)
- ❌ Compras / órdenes de compra
- ❌ Reportes de gestión / costos
- ❌ Configuración del sistema
- ❌ Gestión de usuarios

### Regla de negocio clave
El encargado **nunca ve costos de productos**, solo precios de venta.

### Tablas necesarias
- `usuarios (id, nombre, apellido, email, password_hash, rol_id, sucursal_id, activo)`
- `roles (id, nombre, descripcion)`
- `rol_permisos (rol_id, permiso_id)` — para futura granularidad si se necesita

---

## 20. Cierre de turno y control de caja efectivo

### Planilla actual (en papel + excel)
Estructura: Fecha · Turno · Responsable · Apertura · Ingresos · Egresos · Resultado · Efectivo Real · Diferencia

### Lógica de caja efectivo
- `Apertura` = Efectivo real del cierre del turno anterior (automático)
- `Resultado` = Apertura + Ingresos en efectivo - Egresos en efectivo
- `Efectivo Real` = Lo que el encargado cuenta físicamente
- `Diferencia` = Resultado - Efectivo Real (debe ser 0)

### Flujo de cierre de turno en el sistema
1. Encargado hace clic en "Cerrar turno"
2. Sistema muestra: "El sistema espera **$X** en caja"
3. Encargado escribe el efectivo contado físicamente
4. Sistema calcula diferencia automáticamente
5. Encargado confirma → turno cerrado

### Retiros de efectivo
- Reemplazan la firma en papel
- Campos: fecha, monto, registrado por, observaciones
- Solo Admin puede autorizar retiros (o el mismo encargado con registro)

### Tablas
- `cierres_turno (id, sucursal_id, fecha, turno, usuario_id, apertura, ingresos_sistema, egresos_sistema, resultado_sistema, efectivo_real, diferencia, observaciones, cerrado_at)`
- `retiros_caja (id, sucursal_id, fecha, monto, usuario_id, observaciones, created_at)`

---

## 21. Decisión: Vitrina web propia (reemplaza Empretienda)

### Contexto
- Empretienda: $9.490/mes
- Ventas online reales: 3 en 6 meses (todas retiro en local o Andreani)
- Uso real de la web: catálogo digital — clientes ven precios y stock antes de ir al local
- Problema actual: precios y stock desincronizados entre local (coverweb) y web (Empretienda)

### Decisión confirmada: Opción B — Vitrina propia integrada
- La vitrina web es parte del mismo sistema (misma base de datos)
- Stock y precios siempre sincronizados en tiempo real — sin pasos manuales
- Dominio habitussd.com apunta al sistema propio (cambio DNS tipo A en GoDaddy)
- Empretienda se da de baja una vez que la vitrina esté lista y probada

### Funcionalidades de la vitrina (MVP)
- Catálogo de productos con foto, descripción y precio
- Estado de disponibilidad: en stock / sin stock (por sucursal en el futuro)
- Filtro por rubro y marca
- Búsqueda de productos
- Botón WhatsApp para consultas / compras
- Sin carrito ni pasarela de pago por ahora
- Diseño mobile-first (mayoría consulta desde celular antes de ir al local)

### Ahorro mensual total al reemplazar ambas plataformas
| Plataforma | Costo mensual |
|---|---|
| Coverweb | $204.900 |
| Empretienda | $9.490 |
| Hosting sistema propio (estimado) | ~$20.000 |
| **Ahorro neto** | **~$194.000/mes** |

### Campos web que ya teníamos definidos (se mantienen en el modelo de artículo)
- `disponible_web` (bool)
- `visible_en_tienda` (bool)  
- `precio_web` (puede diferir del local)
- `precio_oferta_web`
- `descripcion`
- `imagen`
- `peso_kg` (para envíos futuros)
- `atributo_nombre` / `atributo_valor` (ej: Sabor)

---

## 22. Migración inicial de datos

### Decisión: Carga directa por base de datos (Opción B)
- Script de migración generado a partir de los archivos Excel existentes:
  - `Listado_Articulos_Cover_0239.xlsx` (488 artículos del local)
  - `Exportacion-productos-13-06-26.xlsx` (369 artículos web con precios, SKU, atributos)
- Se ejecuta una sola vez durante el setup inicial
- Requiere revisión y validación antes de ejecutar en producción
- El script debe manejar: rubros, marcas, tasas IVA, artículos, stock inicial, datos web

### Futuras mejoras
- **Importación masiva por interfaz (Opción A):** módulo para subir CSV/Excel desde el sistema
  - Útil para incorporar productos nuevos en cantidad (ej: catálogo nuevo de proveedor)
  - Incluiría validación de errores fila por fila con reporte de resultado
  - Prioridad: baja — implementar cuando el volumen lo justifique
- **Fiscalización de compras:** registrar facturas de proveedores con validación AFIP (útil si en el futuro cambia el régimen fiscal o se quiere control más formal de compras)
  - Por el momento las compras se registran sin formalidad fiscal (monotributista no deduce IVA)
  - Prioridad: baja — evaluar cuando el negocio crezca o cambie el régimen

---

## 23. Clientes y cuenta corriente

### Contexto histórico
- Hasta 2024 el local estaba a nombre de Enzo Santiago Vega (hijo) — punto de venta 0007
- En 2025/2026 se hizo el traspaso a Ariel Vega — punto de venta 0003
- El PV 0007 ya no está activo en el sistema nuevo

### Tipos de clientes
- **Consumidor Final** — 99% de las ventas, sin datos, sin cuenta corriente
- **Municipalidad de Cinco Saltos** — único cliente especial con cuenta corriente

### Flujo Municipalidad
- Venta cada ~2 meses, montos grandes ($300k-$960k)
- Factura C con descuento por volumen (variable por venta)
- Pago a 15 o 30 días según lo acordado en cada venta
- Cobro por transferencia bancaria (Banco Patagonia)
- Se registra "Orden de Cobro" al momento del pago

### Tablas necesarias
```
clientes (id, razon_social, cuit, domicilio, email, telefono, 
          condicion_iva, tiene_cta_cte, plazo_pago_dias, 
          descuento_habitual, activo)

cobros_pendientes (id, venta_id, cliente_id, fecha_vencimiento, 
                   monto, estado_id, fecha_cobro, medio_cobro_id, 
                   observaciones)
```

### Estados de cobro (tabla de referencia)
`pendiente` / `cobrado` / `vencido`

### Reglas de negocio
- Al seleccionar Municipalidad en venta → activa modo cuenta corriente automáticamente
- Propone plazo de pago habitual (editable por venta)
- Alerta cuando un cobro está próximo a vencer o vencido
- El descuento se define en cada venta (no es fijo)

### Punto de venta
- Solo se usa **PV 00003** — Principal (Electrónico) — para todas las ventas
- PV 0007 (de Enzo) ya no está activo, no se replica en el sistema nuevo

---

## 24. Gastos fijos con vencimiento — Cargas sociales empleados

### Contexto
Ariel tiene 1 empleado en nómina (Agustín Chandia). Mensualmente genera y paga las siguientes boletas:

| Concepto | Organismo | Monto ref. 04/2026 | Vencimiento aprox. |
|---|---|---|---|
| Sindicato (cuota sindical 2%) | Centro Empleados Comercio Cinco Saltos | $13.393,82 | 25 de cada mes |
| F931 (Seg. Social + Obra Social + ART + Seg. Vida) | ARCA/SUSS | $377.906,80 | Variable |
| OSECAC (obra social empleados comercio) | OSECAC | $28.000,00 | Variable |
| FAECYS (federación empleados comercio) | FAECYS | $3.470,40 | 13 de cada mes |
| INACAP (capacitación profesional comercio) | INACAP | $5.394,56 | 15 de cada mes |

### Impacto en el modelo de datos
- Estos conceptos ya están contemplados en la tabla `conceptos_gasto` (tabla de referencia)
- Se agregan como conceptos precargados al inicializar el sistema
- Se agrega campo `fecha_vencimiento` (opcional) a `movimientos_caja` para registrar vencimientos de gastos conocidos
- Permite alertas de vencimiento próximo en el dashboard

### Campo adicional en movimientos_caja
```
movimientos_caja (
  ...campos existentes...,
  fecha_vencimiento DATE NULL,  -- solo para gastos con vencimiento conocido
  estado_pago VARCHAR           -- pendiente / pagado / vencido
)
```

### Alertas propuestas para el dashboard
- Cargas sociales con vencimiento en los próximos 5 días
- Cobros pendientes de la Municipalidad próximos a vencer
- Artículos en stock mínimo

---

## 25. Team Habitus — Sponsoreo de deportistas

### Contexto
Habitus SD apoya a 8 deportistas locales con suplementos mensuales como acción de marketing/sponsoreo. Cada mes se acuerda con cada deportista qué productos necesita (varía por persona y por mes).

### Problema actual
Se registran como "ventas con 100% de descuento", lo que genera:
- Ventas con total $0 que distorsionan el listado de ventas
- El costo registrado es al precio de venta, no al precio de costo real
- No hay visibilidad del gasto real del programa

### Solución propuesta: módulo de salidas por sponsoreo
- Tipo de movimiento de stock nuevo: "Salida Sponsoreo" (tabla `tipos_movimiento_stock`)
- Categoría de gasto nueva: "Team Habitus" (o dentro de "Marketing")
- El gasto se registra al **precio de costo** del artículo, no al precio de venta
- El stock se descuenta igual que una venta

### Flujo mensual
1. Seleccionar deportista + mes
2. Agregar productos con cantidad (variable por deportista y por mes)
3. Sistema calcula costo total automáticamente
4. Registra: salida de stock + gasto en caja al valor de costo

### Tablas necesarias
```
deportistas (id, nombre, apellido, deporte, instagram, 
             activo, fecha_inicio, notas)

sponsoreos (id, deportista_id, mes, año, 
            costo_total, observaciones, created_by)

sponsoreo_items (id, sponsoreo_id, articulo_id, 
                 cantidad, costo_unitario, costo_total)
```

### Reportes útiles
- Costo mensual por deportista
- Costo total del programa Team Habitus por mes/año
- Productos más entregados al Team

### Referencia
- 8 deportistas activos actualmente
- Página: habitussd.com/team-habitus
- Reemplaza completamente el workaround de "venta con 100% descuento"

---

## 26. Modelo de variantes de productos (sabores, tamaños)

### Decisión confirmada
**Sistema interno:** artículos separados por variante (como hoy en coverweb)
- "Classic Whey Protein 2lb Frutilla - One Fit" → artículo independiente
- "Classic Whey Protein 2lb Chocolate - One Fit" → artículo independiente
- "Classic Whey Protein 2lb Vainilla - One Fit" → artículo independiente
- Stock independiente por variante
- Precio puede diferir entre variantes si se necesita
- Simple para el cajero: busca "whey frutilla" y aparece directo

**Vitrina web:** agrupación visual por producto "padre"
- El cliente ve una sola tarjeta "Classic Whey Protein 2lb - One Fit"
- Selector de sabor muestra las variantes disponibles
- Cada variante muestra su stock (disponible / sin stock)
- La agrupación se resuelve en la capa de presentación web, no en la BD

### Implementación técnica
- Campo `atributo_nombre` (ej: "Sabor") y `atributo_valor` (ej: "Frutilla") ya definidos en el modelo de artículo
- Para la agrupación web: campo adicional `nombre_base` o `producto_grupo` que permite agrupar variantes del mismo producto
- Ejemplo: todas las variantes de "Classic Whey Protein 2lb One Fit" comparten el mismo `nombre_base`

### Campo adicional al modelo de artículo
```
articulos (
  ...campos existentes...,
  nombre_base VARCHAR NULL  -- para agrupar variantes en la vitrina web
                            -- ej: "Classic Whey Protein 2lb - One Fit"
)
```

---

## 27. Modo POS — Pantalla de ventas optimizada para lector de código de barras

### Problema actual en coverweb
1. Leer código de barras con pistola
2. Hacer clic en "Buscar" con mouse o pantalla
3. Seleccionar el producto de la lista
4. Ingresar cantidad
5. Hacer clic en "Agregar"
6. Repetir para cada producto

Resultado: para ventas con múltiples productos (ej: 10 geles de 6 sabores), Agustín anota en papel, cobra con calculadora y carga en sistema después.

### Flujo propuesto — Modo POS
1. Campo de búsqueda **siempre activo** (autofocus permanente)
2. Lector envía código + Enter → sistema busca automáticamente
3. Si hay un solo resultado → agrega con cantidad 1 directamente
4. Si hay múltiples resultados → muestra lista para seleccionar
5. Popup de cantidad: si se necesita cambiar, se escribe el número + Enter
6. Foco vuelve automáticamente al campo de búsqueda
7. Lector lee siguiente código → repite sin tocar el mouse

### Requisitos técnicos
- Campo búsqueda con `autofocus` permanente — nunca pierde el foco
- Detectar input de lector (string + Enter en <100ms) vs escritura manual
- Búsqueda automática al recibir Enter desde el lector
- Si código de barras encuentra exactamente 1 producto → agregar directo
- Cantidad por defecto: 1 (modificable con teclado antes de confirmar)
- Después de agregar → foco vuelve al campo de búsqueda instantáneamente
- Soporte búsqueda por: código de barras, código interno, nombre

### Caso de uso crítico
"10 geles de 6 marcas/sabores diferentes" → pasar cada uno por el lector
sin tocar el mouse en ningún momento → venta completada en segundos

### Impacto
- Elimina el flujo actual de "anotar en papel + calculadora + cargar después"
- Reduce errores de carga
- Acelera el tiempo de atención al cliente

---

## 28. Requisitos no funcionales — Velocidad del sistema

### Contexto crítico
Agustín actualmente:
- No usa el lector de código de barras por el tiempo que insume cargar en sistema
- Junta varias ventas y las registra como una sola para no retrasar al cliente
- Consecuencias: stock incorrecto en tiempo real, pérdida de detalle por venta, reporte de caja impreciso

### Causa raíz
El sistema actual (coverweb) es lento para registrar ventas — demasiados clics y pasos manuales.

### Requisitos de velocidad del sistema nuevo
- **Venta de 1 producto:** registrada en menos de 10 segundos
- **Venta de 5 productos:** registrada en menos de 30 segundos
- Lector de código de barras: único dispositivo de entrada necesario durante la venta
- Sin necesidad de mouse durante el flujo de venta
- Si el mismo código se lee dos veces → suma 1 a la cantidad (no duplica línea)
- Respuesta del sistema al leer código de barras: menos de 500ms

### Impacto esperado
- Agustín registra cada venta en tiempo real
- Stock siempre actualizado (vital para la vitrina web)
- Reporte de caja preciso por turno
- Eliminación del flujo "anotar en papel + carga posterior"

### Implicancia técnica
- El frontend (interfaz) debe ser una Single Page Application (SPA — aplicación de una sola página) o equivalente — sin recargas de página entre acciones
- Las búsquedas de productos deben responder en menos de 200ms
- El servidor debe estar en Argentina o con baja latencia (tiempo de respuesta) hacia Cinco Saltos

---

## 29. Trazabilidad de pagos — Problema de conciliación bancaria

### Problema identificado
- Ariel ve ingresos en cuenta bancaria que no puede cruzar con ventas en sistema
- Varios ingresos bancarios aparecen como una sola venta consolidada
- Imposible auditar cuántas ventas reales hubo en el día
- Stock no baja en tiempo real durante el período de "carga posterior"

### Causa raíz
Misma que sección 28: el sistema actual es lento, Agustín consolida ventas para no retrasar clientes.

### Solución propuesta
**1. Modo POS rápido** (sección 27-28) → registrar cada venta en tiempo real

**2. Campo "referencia de pago"** en el cobro por transferencia:
- Cuando el cliente paga por transferencia, Agustín registra: últimos 4 dígitos del CVU, nombre del cliente, o número de comprobante
- Permite cruzar cada venta con el ingreso bancario correspondiente
- Campo opcional pero recomendado para transferencias

**3. Alias de cuenta en el cobro:**
- Ya definido en medios de pago: habitus.sd / camino.doce.doce / habitus.patagonia
- Registrar por qué alias entró cada pago permite saber en qué cuenta mirar

### Campos adicionales en venta_pagos
```
venta_pagos (
  ...campos existentes...,
  referencia    VARCHAR NULL,  -- últimos 4 dígitos CVU, nombre cliente, nro comprobante
  alias_cuenta  VARCHAR NULL   -- habitus.sd / camino.doce.doce / habitus.patagonia
)
```

### Reporte propuesto: conciliación de transferencias
- Ventas del día cobradas por transferencia con su referencia
- Permite cruzar con extracto bancario en minutos
- Detecta pagos recibidos sin venta registrada (o viceversa)

---

## 30. Integración con medios de pago — Automatización de referencias

### Estado actual
- Referencia de pago se carga manualmente en el momento del cobro
- Agustín escribe últimos 4 dígitos o nombre del cliente al ver el comprobante

### Integraciones posibles por medio de pago

| Medio de pago | Integración automática | Viabilidad | Prioridad |
|---|---|---|---|
| Mercado Pago QR | ✅ API + Webhooks disponibles | Alta | MVP v2 |
| Mercado Pago Débito/Crédito | ✅ API + Webhooks disponibles | Alta | MVP v2 |
| Transferencia bancaria | ⚠️ API Banco Patagonia (requiere acuerdo comercial) | Media | Futuro |
| Tarjeta Naranja (postnet) | ❌ Sin API disponible | Baja | No planificado |
| Banco Patagonia (postnet) | ❌ Sin API disponible | Baja | No planificado |
| OpenPay | ⚠️ A verificar | Media | Futuro |

### Integración Mercado Pago (MVP v2)
- Cuando el cliente paga por QR, Mercado Pago envía una notificación (webhook) al sistema
- El sistema detecta el pago, verifica el monto y lo vincula automáticamente a la venta abierta
- La referencia del pago queda registrada sin intervención manual
- Requiere: cuenta de Mercado Pago con acceso a API (credenciales de desarrollador)

### Para el MVP inicial
- Campo referencia manual en venta_pagos
- Agustín lo completa al momento del cobro
- Para transferencias: últimos 4 dígitos CVU o nombre del cliente
- Para QR/postnet: número de cupón o aprobación si está visible

### Futuras mejoras
- Integración Mercado Pago webhooks (pagos QR y débito/crédito)
- Consulta de movimientos bancarios Banco Patagonia (si habilitan API)
- Conciliación automática: cada pago entrante se cruza con ventas pendientes

---

## 31. Mapa completo de medios de pago y fiscalización

### Postnet
El postnet del local es de **Mercado Pago** — acepta QR, todas las tarjetas de débito y crédito. Todo se acredita en la cuenta de Mercado Pago.

### Regla de fiscalización (automática en el sistema)
```
Si medio_pago IN (MP QR, MP Débito, MP Crédito)  → fiscalizar = true
Si medio_pago IN (Efectivo, Transferencia bancaria) → fiscalizar = false
```
El sistema aplica esto automáticamente según el medio de pago seleccionado. El cajero no decide manualmente si fiscalizar.

### Tabla completa

| Medio de pago | Dispositivo | Acreditación | Fiscaliza | Referencia auto |
|---|---|---|---|---|
| QR Mercado Pago | Postnet MP | Cuenta MP | ✅ Sí | ✅ MVP v2 (webhook) |
| Débito (todas) | Postnet MP | Cuenta MP | ✅ Sí | ✅ MVP v2 (webhook) |
| Crédito (todas) | Postnet MP | Cuenta MP | ✅ Sí | ✅ MVP v2 (webhook) |
| Efectivo | — | Caja física | ❌ No | — |
| Transferencia (habitus.sd) | — | Banco Patagonia | ❌ No | Manual |
| Transferencia (camino.doce.doce) | — | Banco Patagonia | ❌ No | Manual |
| Transferencia (habitus.patagonia) | — | Banco Patagonia | ❌ No | Manual |

### Implicancia para integración Mercado Pago (MVP v2)
- Todas las ventas fiscalizadas pasan por MP → un solo webhook cubre todo
- El webhook confirma: monto, medio (QR/débito/crédito), fecha/hora
- Se vincula automáticamente a la venta abierta
- Además dispara la fiscalización AFIP
- Cobertura total de ventas fiscalizadas con una sola integración

---

## 32. Conectividad y modo offline

### Situación actual
- Conexión a internet del local: estable
- Cortes registrados en 2+ años de operación: 1 (una sola vez)

### Decisión: sistema 100% online, sin modo offline
- No se implementa modo offline ni sincronización local
- Elimina una complejidad significativa de desarrollo y mantenimiento
- Contingencia ante corte: conectar el router via hotspot del celular — ya lo hace actualmente. Sin impacto real en la operación

### Requisito de hosting
- Servidor con alta disponibilidad (uptime >99.9%)
- De preferencia con redundancia de red
- Ubicación: Argentina o baja latencia hacia Patagonia

---

## 33. Regla de fiscalización — definición exacta

### Aclaración importante
En coverweb, el código "BAN" (Bancario) agrupa dos medios de pago completamente distintos:
- **Mercado Pago EAV** — cobro por QR o transferencia a cuenta MP → **SÍ fiscaliza**
- **Patagonia EAV** — transferencia bancaria a Banco Patagonia → **NO fiscaliza**

### Regla exacta de fiscalización
```
fiscalizar = TRUE si la venta contiene AL MENOS UNO de:
  - Tarjeta 1 (postnet Mercado Pago)
  - Tarjeta 2 (postnet Mercado Pago)
  - Bancario → Mercado Pago EAV (QR o transferencia a cuenta MP)

fiscalizar = FALSE si la venta contiene SOLO:
  - Efectivo
  - Bancario → Patagonia EAV (transferencia a cuenta bancaria)

Mixto: si contiene al menos un medio que fiscaliza → fiscalizar = TRUE
```

### Medios de pago en el sistema nuevo (tabla `medios_pago`)
| Medio | Fiscaliza | Cuenta destino |
|---|---|---|
| Efectivo | ❌ No | Caja física |
| MP QR | ✅ Sí | Mercado Pago |
| MP Débito | ✅ Sí | Mercado Pago |
| MP Crédito | ✅ Sí | Mercado Pago |
| Transferencia MP | ✅ Sí | Mercado Pago |
| Transferencia Patagonia | ❌ No | Banco Patagonia |
| Transferencia otras cuentas | ❌ No | Otras cuentas |

### Volumen real de fiscalización (desde PV 0003, marzo 2026)
- Promedio: ~100 facturas electrónicas por mes
- Representa ~65-70% de las ventas
- Proceso debe ser automático al confirmar la venta

### Implementación
- Campo `fiscaliza (bool)` en tabla `medios_pago` — define si el medio activa fiscalización
- Al agregar un pago a la venta, el sistema recalcula automáticamente si corresponde fiscalizar
- El cajero no decide manualmente — el sistema lo determina por los medios de pago usados
- La factura se emite a AFIP automáticamente pero NO se imprime/envía salvo pedido del cliente

---

## 34. Inventario completo de tablas de referencia

Principio aplicado: todo valor categórico es una tabla desde el día 1, aunque hoy tenga un solo registro. Lección directa del sistema LNT.

### Tablas geográficas
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `paises` | id, nombre, codigo_iso | Argentina (y otros si se necesita) |
| `provincias` | id, pais_id, nombre, codigo | 24 provincias argentinas |
| `ciudades` | id, provincia_id, nombre | Cinco Saltos + principales |

### Tablas de catálogo de artículos
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `rubros` | id, nombre, descripcion, activo | 21 rubros actuales |
| `marcas` | id, nombre, activo | 40 marcas actuales |
| `tasas_iva` | id, descripcion, porcentaje, activo | 0%, 10.5%, 21% |
| `unidades_medida` | id, nombre, abreviatura | Unidad, Pack, etc. |

### Tablas de ventas y pagos
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `medios_pago` | id, nombre, fiscaliza (bool), cuenta_destino_id, activo | Efectivo, MP QR, MP Débito, MP Crédito, Transferencia MP, Transferencia Patagonia, etc. |
| `cuentas_cobro` | id, nombre, tipo_id, activo | Caja, Mercado Pago EAV, Patagonia EAV, etc. |
| `tipos_comprobante` | id, nombre, codigo_afip | Factura C, Ticket, Remito, etc. |
| `estados_venta` | id, nombre | Guardada, Fiscalizada, Anulada |
| `tipos_descuento` | id, nombre | Porcentaje, Monto fijo |
| `listas_precio` | id, nombre, descripcion | Normal |

### Tablas de stock y movimientos
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `tipos_movimiento_stock` | id, nombre, afecta_stock | Ingreso, Egreso, Transferencia, Salida Sponsoreo, Ajuste |
| `estados_movimiento_stock` | id, nombre | Pendiente, Confirmado, Anulado |
| `estados_disponibilidad_web` | id, nombre, descripcion | en_stock, disponible_pronto, bajo_pedido, sin_stock |

### Tablas de compras y proveedores
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `estados_orden_compra` | id, nombre | Borrador, Confirmada, Anulada |
| `tipos_orden_compra` | id, nombre | Rápida, Completa |

### Tablas de caja y gastos
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `turnos` | id, nombre, hora_inicio, hora_fin | Mañana, Tarde, General |
| `categorias_gasto` | id, nombre, activo | Suplementos, Empleados, Impuestos, Local Comercial, Marketing, Página Web, Servicios, Sistema, Team Habitus |
| `conceptos_gasto` | id, categoria_id, nombre, tiene_vencimiento (bool), activo | Alquiler, Luz, Gas, Sueldo Agustín, F931, OSECAC, FAECYS, INACAP, Sindicato, etc. |
| `estados_pago_gasto` | id, nombre | Pendiente, Pagado, Vencido |
| `tipos_movimiento_caja` | id, nombre | Ingreso, Egreso, Retiro, Apertura, Cierre |

### Tablas de usuarios y accesos
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `roles` | id, nombre, descripcion | Admin, Encargado |
| `permisos` | id, nombre, descripcion | ver_costos, editar_precios, ver_reportes, etc. |
| `rol_permisos` | rol_id, permiso_id | — |

### Tablas de sucursales y puntos de venta
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `sucursales` | id, nombre, domicilio, ciudad_id, activo | Cinco Saltos |
| `puntos_venta` | id, sucursal_id, numero, nombre, tipo_id, activo | 00003 Principal Electrónico |
| `tipos_punto_venta` | id, nombre | Electrónico, Factuweb |
| `depositos` | id, sucursal_id, nombre, activo | Principal |

### Tablas de clientes y cobros
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `condiciones_iva` | id, nombre, codigo_afip | Consumidor Final, Monotributista, Responsable Inscripto, Exento |
| `estados_cobro` | id, nombre | Pendiente, Cobrado, Vencido |

### Tablas de fiscalización
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `tipos_factura_afip` | id, nombre, codigo_afip | Factura C, Nota de Crédito C |
| `estados_factura` | id, nombre | Pendiente, Emitida, Anulada, Error |

### Tablas de monedas
| Tabla | Campos clave | Registros iniciales |
|---|---|---|
| `monedas` | id, nombre, codigo_iso, simbolo, activo | ARS (activa), USD (inactiva) |

### Resumen
Total tablas de referencia identificadas: **30**
Principio: ningún valor categórico hardcodeado en el código ni en columnas de texto libre.

---

## 34. Inventario completo de tablas de referencia

### Lección aplicada del LNT
Todo valor categórico es una tabla desde el día 1, sin excepción.
Aunque hoy tenga un solo registro, la estructura evita refactoring futuro.

### Tablas de referencia — INCLUIR (todas desde día 1)

#### Catálogo de productos
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `rubros` | Categorías de artículos | 21 |
| `marcas` | Marcas de productos | 40 |
| `tasas_iva` | 0%, 10.5%, 21% | 3 |
| `unidades_medida` | Unidad, Pack, etc. | 2-3 |
| `estados_disponibilidad_web` | en_stock, disponible_pronto, bajo_pedido, sin_stock | 4 |

#### Ventas y fiscalización
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `medios_pago` | Efectivo, Transferencia MP, Transferencia Patagonia, etc. con campo `fiscaliza (bool)` | 6-8 |
| `tarjetas` | American Express, Cabal, Maestro, MasterCard, Naranja, Naranja X, Visa (débito y crédito) — relacionada a `medios_pago` | 9 |
| `tipos_comprobante` | Factura C, Ticket, Remito | 3 |
| `estados_venta` | Guardada, Fiscalizada, Anulada | 3 |
| `puntos_venta` | 0003 Principal (Electrónico) | 1 |
| `tipos_cliente` | Consumidor Final, Cliente Especial | 2 |
| `condiciones_iva` | Monotributista, Responsable Inscripto, Exento, Consumidor Final | 4 |
| `estados_cobro` | Pendiente, Cobrado, Vencido | 3 |

#### Stock y movimientos
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `tipos_movimiento_stock` | Ingreso, Egreso, Transferencia, Salida Sponsoreo, Ajuste, Merma | 6 |
| `estados_movimiento_stock` | Pendiente, Confirmado, Anulado | 3 |
| `depositos` | Principal (hoy solo uno) | 1 |

#### Compras
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `estados_orden_compra` | Borrador, Confirmada, Anulada | 3 |
| `tipos_orden_compra` | Rápida, Completa (con comprobante) | 2 |

#### Caja y gastos
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `categorias_gasto` | Suplementos, Empleados, Impuestos, Local, Marketing, Web, Servicios, Sistema, Team Habitus | 9 |
| `conceptos_gasto` | Alquiler, Luz, Gas, Sueldos, AFIP, Faecys, OSECAC, INACAP, etc. | 20+ |
| `turnos` | Mañana, Tarde, General | 3 |
| `estados_cierre_turno` | Abierto, Cerrado, Con diferencia | 3 |
| `cuentas_bancarias` | Mercado Pago EAV, Patagonia EAV, etc. | 3-4 |

#### Usuarios y acceso
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `roles` | Admin, Encargado | 2 |
| `estados_usuario` | Activo, Inactivo | 2 |

#### Geografía
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `paises` | Argentina (+ estructura para más) | 1 |
| `provincias` | Río Negro, Neuquén, etc. | 24 (todas) |
| `localidades` | Cinco Saltos, Cipolletti, etc. | Principales de Río Negro/Neuquén |

#### Precios
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `tipos_precio` | Local, Web, Mayorista, Oferta web | 4 |
| `monedas` | ARS (activa), USD (estructura lista) | 2 |

#### Sponsoreo
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `estados_sponsoreo` | Pendiente, Entregado, Anulado | 3 |

#### Sucursales y sistema
| Tabla | Descripción | Registros iniciales |
|---|---|---|
| `sucursales` | Cinco Saltos (hoy), futuras | 1 |

---

### Tablas de coverweb que NO incluimos

| Tabla coverweb | Motivo exclusión |
|---|---|
| Actividades Económicas | No aplica al negocio |
| Campos Extras / Grupos Campos Extras | Over-engineering para este sistema |
| Categorías Responsables / Grupos Responsables | No aplica |
| Colores / Colores Artículos | No aplica (suplementos no tienen color) |
| Comisiones Vendedores Rubros | No aplica (sin comisiones) |
| Despiece Listas de Precios | No aplica |
| Despiece Materia Prima | No aplica (no producción) |
| Formularios / Respuestas | No aplica |
| Índices Inflación | No aplica |
| Matriz de Medidas | No aplica |
| Pagos Anticipados | No aplica |
| Plantillas Artículos | No aplica |
| Rutas de Viaje | No aplica |
| Slider Web | Reemplazado por vitrina propia |
| Subcategorías / Subrubros | No usados |
| Sueldos | Registrado en movimientos_caja |
| Tareas Internas | No aplica |
| Transportistas | No aplica |
| Vehículos | No aplica |
| Zonas | No aplica |
| Vendedores | Reemplazado por tabla usuarios |
| Fabricantes | Reemplazado por tabla marcas |

---

### Nota sobre tarjetas
Las tarjetas (Visa, MasterCard, Naranja, etc.) van en tabla separada `tarjetas`
relacionada a `medios_pago`. Una venta con pago por tarjeta referencia:
- `medio_pago_id` → "Tarjeta" (registro en `medios_pago`)
- `tarjeta_id` → "Visa Crédito" (registro en `tarjetas`)
- `cupon` y `nro_autorizacion` → campos en `venta_pagos`

---

## 35. Revisión de terminología y arquitectura de Movimientos (ledger único)

### Contexto
Tras revisión externa del análisis, se incorporan tres mejoras estructurales que impactan terminología y arquitectura, sin cambiar el alcance funcional ya definido.

### Cambio 1 — Categoría de gasto: "Suplementos" → "Compras Mercadería"
La categoría debe representar el **hecho económico**, no el rubro del producto.
El artículo y el proveedor ya identifican qué se compró; la categoría solo indica
que es una compra de mercadería para reventa. Esto sostiene la categoría estable
aunque el catálogo crezca a otros rubros (indumentaria, accesorios, merchandising).

### Cambio 2 — Conceptos genéricos + contraparte separada
**Antes:** concepto = "Sueldo Agustín", "Limpieza Fabiana" (dato compuesto)
**Ahora:** concepto genérico + campo contraparte separado

| Categoría | Concepto | Contraparte |
|---|---|---|
| Empleados | Sueldo | Agustín |
| Servicios | Limpieza | Fabiana |
| Impuestos | Honorarios Contables | Estudio Contable |

Si cambia la persona o el proveedor, no se crea un concepto nuevo — solo cambia
la contraparte. El histórico y los reportes por concepto quedan intactos.

### Cambio 3 — Módulo "Caja/Gastos" → "Movimientos" (arquitectura de dos niveles)

**Nivel 1 — Operativo:** Ventas, Compras, Stock, Clientes, Proveedores.
Cada pantalla sigue siendo simple y específica para su tarea — sin cambios en el flujo del cajero o encargado.

**Nivel 2 — Financiero:** Tabla única `movimientos` (ledger). Toda operación
del Nivel 1 que tiene efecto económico genera automáticamente un registro acá.

```
Venta confirmada
  → movimiento: tipo=Ingreso, categoria=Ventas, concepto=Venta Local,
    cuenta=Caja/MP, contraparte=Consumidor Final, turno=Mañana, usuario=Agustín

Compra confirmada
  → movimiento: tipo=Egreso, categoria=Compras Mercadería, concepto=Compra Mercadería,
    cuenta=Transferencia, contraparte=Black Suplementos

Pago de sueldo
  → movimiento: tipo=Egreso, categoria=Empleados, concepto=Sueldo,
    cuenta=Efectivo, contraparte=Agustín
```

**Ventaja:** un solo reporte de Movimientos (filtrable por categoría, concepto,
cuenta, contraparte, turno, fecha) reemplaza la necesidad de combinar datos de
múltiples tablas para el reporte de caja y el balance mensual.

**Regla de desarrollo (similar a lecciones LNT):** todo módulo nuevo que tenga
efecto económico DEBE generar su registro correspondiente en `movimientos`.
Si se omite, el reporte financiero queda incompleto aunque la operación esté
registrada correctamente en su tabla operativa. Esto se valida explícitamente
al diseñar cada módulo nuevo.

### Terminología unificada (válida para todo el sistema)
| Término | Significado |
|---|---|
| Categoría | Clasificación económica del movimiento (Ventas, Compras Mercadería, Empleados, etc.) |
| Concepto | Subtipo específico dentro de la categoría (Sueldo, Venta Local, Compra Mercadería) |
| Contraparte | Persona, empresa u organismo involucrado (cliente, proveedor, empleado, organismo fiscal) |
| Cuenta | Dónde está o circula el dinero (Caja, Mercado Pago, Banco Patagonia) |
| Movimiento | Cualquier hecho económico que modifica la situación del negocio |

### Tablas actualizadas
```
movimientos (
  id, sucursal_id, fecha, tipo (Ingreso/Egreso),
  categoria_id, concepto_id, contraparte_id NULL,
  cuenta_id, monto, turno_id NULL, usuario_id,
  referencia_origen_tipo,   -- 'venta' | 'compra' | 'sponsoreo' | 'manual'
  referencia_origen_id,     -- id de la venta/compra/sponsoreo que lo generó
  observaciones, estado_pago, fecha_vencimiento
)

contrapartes (
  id, tipo (cliente/proveedor/empleado/organismo/otro),
  nombre, cuit, telefono, email, notas
)
```

### Nota de implementación — CONFIRMADO
Se mantienen `clientes` y `proveedores` como tablas completas separadas
(ya diseñadas con sus campos específicos: cuenta corriente para clientes,
CBU/alias para proveedores). `contrapartes` es una tabla liviana de
referencia rápida para el ledger, con FK opcional hacia la tabla específica
según el tipo:

```
tipos_contraparte (id, nombre)  -- Cliente / Proveedor / Empleado / Organismo / Otro

contrapartes (
  id, tipo_id,           -- FK a tipos_contraparte
  nombre,
  cliente_id    NULL,    -- FK a clientes, solo si tipo = Cliente
  proveedor_id  NULL,    -- FK a proveedores, solo si tipo = Proveedor
  empleado_id   NULL,    -- FK a usuarios, solo si tipo = Empleado
  notas
)
```

Un movimiento solo necesita `contraparte_id` (un JOIN simple para reportes).
Para el detalle completo (cuenta corriente, CBU, etc.) se navega desde
`contrapartes` hacia la tabla específica correspondiente.

**Ejemplos:**
- Municipalidad → contrapartes(tipo=Cliente, cliente_id=1) → clientes(tiene_cta_cte=true)
- Black Suplementos → contrapartes(tipo=Proveedor, proveedor_id=3) → proveedores(cbu_alias=...)
- Agustín (sueldo) → contrapartes(tipo=Empleado, empleado_id=2) → usuarios(rol=Encargado)

---

## 36. Decisión final — Modelo de entidad en Movimientos (solución híbrida)

### Contexto de la discusión
Se evaluaron tres alternativas para vincular un movimiento con quién está involucrado (cliente, proveedor, empleado, organismo):

1. Tabla `contrapartes` intermedia — descartada: agrega JOIN extra sin beneficio real para este proyecto
2. 3+ campos FK reales (`cliente_id`, `proveedor_id`, `usuario_id`, ...) — descartada: cada tipo nuevo de entidad (ya se identificaron 4: Cliente, Proveedor, Empleado, Organismo) obliga a alterar la tabla central `movimientos` y todo el código que la consulta
3. **`entidad_tipo` + `entidad_id` (polimórfico) con trigger de validación — DECISIÓN FINAL**

### Modelo confirmado

```sql
tipos_entidad (id, nombre)  -- Cliente / Proveedor / Empleado / Organismo / Otro

movimientos (
  id, fecha, tipo (Ingreso/Egreso), categoria_id, concepto_id,
  entidad_tipo_id NULL,   -- FK a tipos_entidad
  entidad_id      NULL,   -- id en la tabla correspondiente según entidad_tipo_id
  cuenta_id, monto, observaciones,
  turno_id NULL, usuario_registro_id,  -- quién operó el sistema (distinto de la entidad)
  origen_tipo,    -- 'venta' | 'compra' | 'sponsoreo' | 'cierre_turno' | 'manual'
  origen_id,      -- id del registro que generó el movimiento
  fecha_vencimiento NULL, estado_pago
)
```

### Trigger de validación (integridad referencial controlada)
Un trigger `BEFORE INSERT/UPDATE` en Postgres valida, según `entidad_tipo_id`,
que `entidad_id` exista en la tabla correspondiente:

```
Si entidad_tipo = Cliente   → validar existencia en clientes
Si entidad_tipo = Proveedor → validar existencia en proveedores
Si entidad_tipo = Empleado  → validar existencia en usuarios
Si entidad_tipo = Organismo → validar existencia en organismos
```

### Por qué esta solución y no las otras
- **vs. tabla `contrapartes`:** evita el JOIN intermedio en cada reporte; el modelo es más directo
- **vs. FK reales múltiples:** agregar un tipo de entidad nuevo no requiere alterar la tabla `movimientos` ni el código que la consulta — solo agregar el caso al trigger y a la lógica de presentación
- **Costo aceptado:** Postgres no garantiza la integridad referencial de forma nativa (no hay FK constraint clásica) — se compensa con el trigger, que cumple la misma función de forma explícita y controlada

### Ejemplos de uso
| Movimiento | entidad_tipo | entidad_id (apunta a) |
|---|---|---|
| Venta local | Cliente | clientes.id (o NULL si Consumidor Final) |
| Compra a Black | Proveedor | proveedores.id |
| Sueldo Agustín | Empleado | usuarios.id |
| Pago FAECYS | Organismo | organismos.id |
| Ajuste de caja sin contraparte | NULL | NULL |

### Tabla adicional confirmada
```
organismos (id, nombre, cuit, tipo, notas)
-- AFIP/ARCA, OSECAC, FAECYS, INACAP, Centro Empleados de Comercio, etc.
```

---

## 37. Bug identificado en coverweb — pantalla de cobro (a evitar en el sistema nuevo)

### Comportamiento observado
1. Se carga un pago bancario en popup "Datos del movimiento" (cuenta Mercado Pago EAV, Transferencia, número de operación, importe $38.000)
2. Se acepta el popup
3. El saldo pendiente en la pantalla principal **no se actualiza** — sigue mostrando $38.000 pendiente aunque el pago ya cubre el total
4. Al fiscalizar, la venta queda registrada como **Efectivo** en lugar del medio bancario real cargado

### Causa
El campo "Imp. Bancario" y el cálculo de saldo pendiente no están sincronizados de forma reactiva — dependen de que el usuario note la inconsistencia y la corrija manualmente.

### Requisito para el sistema nuevo
- El cálculo de saldo pendiente debe recalcularse inmediatamente al cargar cualquier pago, sin pasos intermedios ni popups que puedan desincronizarse
- El medio de pago efectivamente cargado debe reflejarse correctamente en el comprobante fiscal — nunca defaultear a Efectivo
- El registro de pago bancario/transferencia se integra en la misma pantalla de cobro, sin abrir una ventana modal separada (alineado con el requisito de velocidad de la sección 28)

---

## 38. Aclaración — Alcance de la integración con Mercado Pago (webhook)

### Qué NO es
No es una conexión directa del sistema con el dispositivo físico del postnet.

### Qué SÍ es
Una integración por **webhook**: cuando Mercado Pago procesa un cobro (QR, débito o
crédito vía el postnet, o una transferencia a la cuenta MP), sus servidores envían
una notificación automática al sistema con monto, medio y fecha/hora. El sistema
recibe esa notificación y vincula el pago a la venta abierta sin intervención manual.

### Comparación con el flujo manual actual (sección 37, imagen 4)
| Paso | Hoy (manual) | Con webhook MP (MVP v2) |
|---|---|---|
| Copiar número de operación | Agustín lo tipea a mano | Llega automático |
| Confirmar monto | Manual | Automático, validado contra el cobro real |
| Vincular a la venta | Manual | Automático |

### Alcance — qué cubre y qué no
- ✅ Cubre: QR Mercado Pago, Débito (postnet MP), Crédito (postnet MP), Transferencia a cuenta Mercado Pago EAV
- ❌ No cubre: Transferencias a Banco Patagonia u otras cuentas — siguen siendo manuales (campo de referencia, sección 29)

### Para el MVP inicial (sin webhook todavía)
El campo de referencia de pago se completa en la misma pantalla de cobro,
sin popup separado — evita el bug de sincronización descrito en la sección 37.

### Efecto esperado en el comportamiento del encargado
El webhook invierte el orden roto que existe hoy:
- **Hoy:** vende → cobra → carga en el sistema más tarde (a veces consolidando varias ventas)
- **Con sistema nuevo + webhook MP:** abre la venta → el cliente paga con postnet → el
  webhook confirma el cobro en el momento → se cierra la venta

Si la venta no se registra en el sistema en el momento del cobro, el pago de MP
queda sin venta asociada y aparece como pendiente de conciliar — visible y fácil
de detectar, a diferencia del problema actual donde se pierde el detalle sin
que nadie lo note. El sistema termina incentivando la buena práctica por diseño,
sin depender de la disciplina del encargado. Esto refuerza por qué el modo POS
(secciones 27-28) debe cumplir el objetivo de menos de 10 segundos por producto:
solo así registrar en el momento es más rápido que posponerlo.

---

## 39. Corrección al modelo de artículo — múltiples imágenes

### Problema identificado
El campo `imagen` (columna única en `articulos`) solo permite una foto por
producto. Para la vitrina web se necesitan múltiples imágenes (distintos
ángulos, envase, tabla nutricional, etc.).

### Decisión
Se elimina el campo `imagen` de `articulos` y se reemplaza por una tabla
relacionada — siguiendo la misma lógica de no hardcodear cantidades fijas
que ya se aplicó al descartar los campos "Imagen 1/2/3 con título y
comentario" de coverweb (sección 6).

```sql
articulo_imagenes (
  id, articulo_id FK,
  url, orden int,
  es_principal bool,
  alt_text NULL
)
```

### Reglas de uso
- `orden` controla la secuencia de visualización en la vitrina web
- `es_principal` marca cuál se muestra en tarjetas de listado, sin
  necesidad de recorrer todas las imágenes para encontrar la primera
- `alt_text` opcional, útil para SEO de la vitrina web
- Un artículo puede tener cero, una o varias imágenes sin límite fijo

---

## 40. Revisión final del panel de especialistas sobre el ERD

### Confirmaciones aplicadas

**Descuento por línea de venta** [UX]: confirmado. `venta_items` ya contaba
con el campo `descuento` (visible en el diagrama de la sección "ventas y pagos"),
coexistiendo con el descuento a nivel de venta completa en `ventas.descuento`.
Ambos niveles quedan disponibles: descuento general de la venta (ej. cliente
frecuente) y descuento puntual por producto (ej. promo combo 15% off).

### Pendientes de implementación (no bloqueantes para el ERD, a resolver en desarrollo)

**Índice único en factura_cae** [AFIP]: cuando `ventas.factura_cae` no es
null, debe tener un índice único — AFIP nunca repite un CAE, por lo que esto
es una validación de integridad gratuita a nivel de base de datos.

**Reintentos de fiscalización** [AFIP]: agregar campo `fiscalizacion_intentos`
(o equivalente) en `ventas` para detectar y alertar cuando el envío a AFIP
falla repetidamente — evita que una venta quede fiscalizada a medias sin que
se note, dado que los servicios de AFIP tienen caídas históricas conocidas.

**Trigger de validación en origen_tipo/origen_id** [DEV]: el mismo patrón
polimórfico aplicado a `entidad_tipo_id`/`entidad_id` en `movimientos`
(sección 36) se repite en `movimientos.origen_tipo`/`origen_id`. Por
consistencia, aplicar el mismo trigger de validación — aunque el riesgo es
menor porque el origen siempre lo genera el propio sistema, no un humano.

### Conclusión del panel
El esquema cubre la totalidad del análisis funcional (39 secciones) sin
incorporar funcionalidad no justificada por un caso de uso real del negocio.
El ERD queda confirmado como base para el desarrollo, con los tres puntos
de implementación de esta sección a aplicar durante la construcción del
esquema SQL definitivo.

---

## 41. Auditoría externa del módulo de facturación AFIP — resolución completa

### Contexto
Se realizó una auditoría de 8 perspectivas de ingeniería (Arquitecto de Datos,
AFIP/Fiscal, Seguridad, Integraciones, Performance, Resiliencia, UX/Operativo,
Deuda Técnica) sobre el análisis y ERD existentes (secciones 1-40), con foco en
el módulo de facturación electrónica. Se identificaron 4 puntos críticos y se
resolvieron con las siguientes decisiones confirmadas.

### Decisión 1 — Separación de `comprobantes` y `ventas`
**Confirmado: se van a necesitar notas de crédito/débito.** Esto obliga a
modelar el comprobante fiscal como entidad propia, independiente de la venta.

```sql
comprobantes (
  id, venta_id FK,                    -- la operación comercial que lo origina
  tipo_comprobante_id FK,             -- Factura C / Nota de Crédito C / Nota de Débito C
  punto_venta_id FK,
  numero,                             -- correlativo por punto_venta + tipo
  fecha_emision,
  comprobante_asociado_id NULL FK,    -- self-FK: una NC/ND referencia la factura que ajusta
  estado_fiscal_id FK,                -- ver Decisión 2
  cae NULL,
  cae_vencimiento NULL,
  impreso_enviado bool,
  total
)
```

Una venta puede tener 0, 1 o más comprobantes asociados a lo largo del tiempo
(factura inicial + nota de crédito posterior por devolución, por ejemplo).
`ventas` deja de tener `factura_numero`/`factura_cae`/`factura_impresa` —
esos campos se mueven a `comprobantes`.

### Decisión 2 — Máquina de estados de fiscalización (asíncrona, confirmado)
**Confirmado: la venta se cierra igual aunque AFIP esté caído; la factura
queda "pendiente de CAE" y se reintenta en background.** Esto resuelve la
tensión entre el objetivo de <10 segundos por venta (sección 28) y la
fiscalización — el cajero nunca espera la respuesta de AFIP/ARCA ni del
proveedor de fiscalización elegido (ver corrección de proveedor más abajo,
sección 41).

```sql
estados_fiscales (id, nombre)
-- Pendiente / Enviado / CAE_Recibido / CAE_Rechazado / Reintentando

comprobantes.estado_fiscal_id FK estados_fiscales
```

**Confirmado: el cajero ve un mensaje en pantalla** cuando la venta se cierra
con la fiscalización en curso (ej. "Venta registrada — factura en proceso").
No es un proceso completamente silencioso, pero tampoco bloquea ni requiere
espera activa.

**Confirmado: no se requiere notificación ni panel de alertas** para
comprobantes que quedan pendientes o fallan tras reintentos — el dato queda
registrado en `comprobantes.estado_fiscal_id` y `intentos_fiscalizacion`
(Decisión 4) para consulta cuando se necesite, sin notificación proactiva.

### Decisión 3 — Multi-CUIT (descartado explícitamente)
**Confirmado: Habitus SD va a operar siempre bajo un único CUIT.** El traspaso
de Enzo Santiago Vega (PV 0007) a Ariel Vega (PV 0003) ya documentado en la
sección 23 fue un cambio de titularidad histórico, no una operación
multi-entidad simultánea. Se decide explícitamente **no modelar multi-tenant
ni múltiples razones sociales** — la configuración fiscal (CUIT, condición
de IVA del emisor, credenciales del proveedor de fiscalización elegido) vive en una tabla de
configuración única (`configuracion_fiscal`), no en una tabla `empresas`.
Esta decisión queda documentada para que no sea un olvido sino una elección
consciente, revisable si el contexto del negocio cambiara en el futuro.

### Decisión 4 — Log de intentos de fiscalización con respuesta cruda
**Confirmado: se guarda la respuesta cruda del proveedor de fiscalización en cada intento,
exitoso o fallido**, para auditoría.

```sql
intentos_fiscalizacion (
  id, comprobante_id FK,
  numero_intento,
  fecha_hora,
  resultado (exito/error),
  respuesta_cruda_json,    -- payload completo devuelto por el proveedor de fiscalización
  mensaje_error NULL
)
```

### Decisión 5 — Tipo de comprobante según condición de IVA (a definir en desarrollo)
Queda pendiente para la etapa de desarrollo —no bloquea el ERD— la regla
explícita de qué `tipo_comprobante_id` corresponde según la
`condicion_iva_id` del cliente. Hoy el caso único es Factura C (monotributista
emisor, sin importar la condición del receptor), por lo que la regla actual
es trivial, pero debe quedar como función/regla explícita en el código y no
asumida implícitamente.

### Impacto en tablas de referencia (actualiza inventario de sección 34)
Se agregan: `estados_fiscales`, `configuracion_fiscal` (tabla de configuración
de instancia única, no catálogo). Se confirma la necesidad de completar
`condiciones_iva` con el catálogo completo de AFIP (Responsable Inscripto,
Monotributista, Exento, Consumidor Final, No Categorizado), no solo los
valores usados hoy.

### Pendiente técnico no resuelto en el análisis (a resolver en el esquema SQL)
Mecanismo de numeración correlativa sin huecos por `punto_venta_id` +
`tipo_comprobante_id`, mediante secuencia o bloqueo atómico en PostgreSQL —
no un contador gestionado desde la aplicación. Crítico para cumplimiento
legal con el modo POS de alta velocidad (riesgo de condición de carrera con
múltiples ventas casi simultáneas).
