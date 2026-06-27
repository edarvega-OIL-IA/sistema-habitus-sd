# Reglas de UI — Sistema Habitus SD

## Teclado y foco

- El campo de búsqueda de productos (POS) siempre tiene foco y el texto siempre está seleccionado (select all)
- Después de agregar un producto, el foco vuelve al buscador con el campo limpio
- El lector de código de barras limpia el campo antes de escribir (nunca concatena)
- El panel derecho (pagos, descuento) se opera con mouse/touch; el teclado es exclusivo del panel izquierdo durante la venta

## Teclas rápidas (Ctrl + letra)

| Tecla | Acción |
|---|---|
| Ctrl + F | Fiscalizar |
| Ctrl + G | Guardar |
| Ctrl + D | Descuento |
| Ctrl + P | Agregar pago |
| Ctrl + B | Devolver foco al buscador |
| Ctrl + X | Cancelar venta |

## Popup de cantidad (POS)

Se confirma con lo que ocurra primero:
- Enter explícito
- Lectura de otro código de barras
- 2 segundos sin actividad (timer automático)

## Listas de items (orden de compra, ventas, y cualquier pantalla con lista)

- El buscador para agregar items **siempre va arriba** de la lista
- Los items se acumulan debajo del buscador

## Referencia de pago MP

- El número de operación se muestra en el chip de pago
- Es de solo lectura para el Encargado
- Solo el Admin puede corregirlo (ícono de edición visible solo para Admin)

## Módulo Caja (ex Cierre de turno)

- Flujo obligatorio: Apertura → operaciones → Cierre
- Apertura: cajero ve monto esperado (del cierre anterior) + ingresa efectivo contado físicamente → diferencia automática
- Toda la pantalla de cierre es solo lectura excepto "Efectivo contado" y "Observaciones"
- Ventas, gastos y retiros se muestran desde movimientos — no se cargan en el cierre
- Fórmula esperado en caja: Apertura + Ventas efectivo + Ingresos efectivo − Egresos efectivo − Retiros
- Retiro: selector de usuario "Entregado a" (obligatorio), monto con separador de miles
- Monto retiro no puede superar el esperado en caja
- Horas siempre en timezone America/Argentina/Buenos_Aires

## Fiscalización

- La acción la elige el cajero (Fiscalizar vs Guardar)
- Si hay un medio de pago con fiscaliza_por_defecto=true, el sistema muestra una sugerencia visual pero no obliga

## Formateo de montos

- Separador de miles: punto (.)
- Siempre usar toLocaleString('es-AR') para mostrar montos
- Inputs de monto: solo dígitos, formatear en tiempo real con punto de miles
- Nunca usar input type="number" para montos — usar type="text" + inputMode="numeric"

## Combos encadenados (Categoría/Concepto en movimientos)

- Categorías se filtran por tipo de movimiento (Ingreso/Egreso)
- Conceptos se filtran por categoría seleccionada Y tipo de movimiento
- Si hay un solo resultado → autoseleccionar
- Al cambiar tipo → resetear categoría y concepto
