import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between pl-16 pr-4 md:px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#3c3c3b]">{user?.email}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-white bg-[#3c3c3b] px-3 py-1 rounded hover:bg-black transition-colors"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  )
}