// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\mayoristas\nueva\page.tsx
//
// Alta de venta mayorista. Toda la lógica vive en el formulario compartido
// (components/mayoristas/VentaMayoristaForm.tsx), que también se usa para editar.
'use client'

import VentaMayoristaForm from '@/components/mayoristas/VentaMayoristaForm'

export default function NuevaVentaMayoristaPage() {
  return <VentaMayoristaForm modo="crear" />
}
