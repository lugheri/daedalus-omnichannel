import { MessagesSquare } from 'lucide-react'
import { Outlet } from 'react-router'

/** Moldura das telas sem login: marca no topo e o formulário centralizado. */
export function AuthLayout() {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <MessagesSquare className="text-primary size-6" />
        Daedalus Omnichannel
      </div>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
