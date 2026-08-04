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
