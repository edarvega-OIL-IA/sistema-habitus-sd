import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function SistemaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#ededed]">
      <Sidebar />
      {/* md:ml-56 compensa que el Sidebar pasó a "fixed" en desktop (antes
          era "static" y el flex reservaba el espacio solo; al sacarlo del
          flujo normal, el contenido necesita este margen para no quedar
          tapado debajo del menú) */}
      <div className="flex-1 flex flex-col md:ml-56">
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
