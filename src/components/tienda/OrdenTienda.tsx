// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\OrdenTienda.tsx
'use client'

// Componente controlado: el estado del orden vive en CatalogoTienda (antes
// leía la URL con useSearchParams y cada cambio le pedía la página al servidor).
interface Props {
  orden: string                       // '' = "Ordenar por" (aleatorio)
  onCambio: (valor: string | null) => void
}

export default function OrdenTienda({ orden, onCambio }: Props) {
  return (
    <select
      value={orden || 'relevancia'}
      onChange={e => onCambio(e.target.value === 'relevancia' ? null : e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-offer-teal focus:border-transparent"
    >
      <option value="relevancia">Ordenar por</option>
      <option value="nombre_asc">Alfabético: A-Z</option>
      <option value="nombre_desc">Alfabético: Z-A</option>
      <option value="precio_asc">Precio: menor a mayor</option>
      <option value="precio_desc">Precio: mayor a menor</option>
    </select>
  )
}
