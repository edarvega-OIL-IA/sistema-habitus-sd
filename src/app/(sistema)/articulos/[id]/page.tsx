import ArticuloForm from '@/components/articulos/ArticuloForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarArticuloPage({ params }: PageProps) {
  const { id } = await params
  const articuloId = parseInt(id)

  return <ArticuloForm articuloId={articuloId} />
}
