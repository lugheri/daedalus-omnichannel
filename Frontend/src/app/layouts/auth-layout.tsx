import { Outlet } from 'react-router'
import { ThemeToggle } from '@/components/theme-toggle'

/** Moldura das telas sem login: marca no topo e o formulário centralizado. */
export function AuthLayout() {
  return (
    <div className="bg-background relative flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <ThemeToggle className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3" />
      <div className="text-lg font-extrabold tracking-[0.09em]">
        DAEDALUS
        <span className="text-muted-foreground ml-2 text-sm font-medium tracking-normal">
          Omnichannel
        </span>
      </div>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
