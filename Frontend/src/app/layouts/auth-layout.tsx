import { Outlet } from 'react-router'

/** Moldura das telas sem login: marca no topo e o formulário centralizado. */
export function AuthLayout() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6">
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
