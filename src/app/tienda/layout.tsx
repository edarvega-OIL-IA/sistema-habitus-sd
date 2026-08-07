// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\layout.tsx
import { CarritoProvider } from '@/components/tienda/CarritoContext'

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return <CarritoProvider>{children}</CarritoProvider>
}
