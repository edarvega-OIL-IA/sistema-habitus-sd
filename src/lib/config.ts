// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\config.ts

/**
 * Mientras Ariel sea monotributista, el IVA que le cobra un proveedor NO se
 * recupera como crédito fiscal (no hace el mecanismo de débito/crédito de un
 * Responsable Inscripto) — es plata que paga y no vuelve, así que es costo
 * real del artículo. Por eso el costo de compra que usa todo el sistema
 * (Compras, Dashboard, Reportes, Precios) es el TOTAL efectivamente pagado
 * al proveedor + flete, sin descontar ningún IVA, discrimine el proveedor
 * IVA en su comprobante o no.
 *
 * El día que Ariel pase a ser Responsable Inscripto, cambiar esto a `true`:
 * a partir de ese momento el IVA de las compras SÍ se recupera, y el costo
 * real pasa a ser el neto sin IVA. Las compras ya cargadas ANTES del cambio
 * quedan con el costo que tenían — en su momento el IVA no era recuperable,
 * así que ese fue su costo real para siempre, no se recalcula retroactivo.
 */
export const RECUPERA_IVA_COMPRAS = false

/**
 * ID del artículo sintético "Envío a domicilio" (creado 07/09/2026, id=1385
 * en producción). Nunca aparece en el catálogo — disponible_web=false,
 * disponible_local=false, visible_en_tienda=false — se usa únicamente para
 * insertar el costo de envío como un `venta_item` real en cualquier venta
 * web con `costo_envio > 0`.
 *
 * Motivo (sesión 07/09/2026): `mapearVentaAFacturaC` calcula
 * `bonificacion = subtotalDetalle - venta.total`. Sin esta línea, el envío
 * queda afuera de `subtotalDetalle` pero sí dentro de `venta.total`, dando
 * una bonificación NEGATIVA (un recargo disfrazado de descuento) y un PDF
 * de factura sin ninguna línea que explique el cobro de envío. El total que
 * recibe ARCA siempre fue correcto (WSFEv1 solo mira `total`, no el
 * detalle) — este fix es de prolijidad del comprobante, no una corrección
 * fiscal retroactiva.
 *
 * Sin stock asociado — se excluye a propósito del loop que arma
 * `movimiento_stock_items` en api/tienda/webhook-mp/route.ts (nunca debe
 * generar un movimiento de stock).
 */
export const ARTICULO_ENVIO_ID = 1385
