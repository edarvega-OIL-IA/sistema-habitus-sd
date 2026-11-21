// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\layout.tsx
import type { Metadata } from 'next'
import { CarritoProvider } from '@/components/tienda/CarritoContext'
import RedesSocialesFlotantes from '@/components/tienda/RedesSocialesFlotantes'

// Metadata propia de la Vitrina: sobrescribe la global del sistema ("Sistema de gestión...")
// solo dentro de /tienda. Las páginas que definen su propio title (ficha de producto) lo siguen pisando.
export const metadata: Metadata = {
  title: 'Hábitus Suplementos Deportivos | Tienda online',
  description:
    'Proteínas, creatinas, pre-entrenos, geles y más. Comprá online y retirá en Hábitus, Cinco Saltos.',
}

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CarritoProvider>
      {children}
      <RedesSocialesFlotantes />
    </CarritoProvider>
  )
}
