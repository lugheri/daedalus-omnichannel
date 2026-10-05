import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { useMe, usePermissions } from '@/features/auth/session-context'
import { RealtimeProvider } from '@/features/realtime/realtime-provider'
import { cn } from '@/lib/utils'
import { itemsOf, locate, visibleModules, type NavModule } from '../navigation'
import { Breadcrumbs } from './shell/breadcrumbs'
import { CommandPalette } from './shell/command-palette'
import { ModulePanel } from './shell/module-panel'
import { ModuleRail } from './shell/module-rail'
import { TopBar } from './shell/top-bar'
import { useStoredFlag } from './shell/use-stored-flag'

/** Abaixo disto (o `md` do Tailwind), trilho e painel viram gaveta. */
const MOBILE_QUERY = '(max-width: 767px)'

/**
 * Moldura das telas logadas: barra do topo, trilho de módulos, painel com
 * as telas do módulo e o conteúdo com a trilha "Módulo › Grupo › Tela".
 * Tudo filtrado por permissão. No celular, trilho e painel viram gaveta.
 */
export function AppLayout() {
  const me = useMe()
  const { canAny } = usePermissions()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Telas que ocupam a área inteira (ex.: caixa de entrada) declaram handle: { fullBleed: true }.
  const fullBleed = useMatches().some(
    (match) => (match.handle as RouteHandle | undefined)?.fullBleed,
  )

  const modules = useMemo(() => visibleModules(canAny), [canAny])
  const location = locate(modules, pathname)

  const [railCompact, setRailCompact] = useStoredFlag('omni.shell.railCompact', false)
  const [panelCollapsed, setPanelCollapsed] = useStoredFlag('omni.shell.panelCollapsed', false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Na gaveta, tocar num módulo mostra as telas dele antes de navegar.
  const [drawerModule, setDrawerModule] = useState<NavModule | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Voltar a um módulo reabre a última tela vista nele (nesta aba e nesta conta:
  // depois de trocar de conta, a tela da anterior não existe mais).
  const lastVisited = useRef(new Map<string, string>())
  useEffect(() => {
    if (location) lastVisited.current.set(`${me.tenant.id}:${location.module.key}`, pathname)
  }, [location, pathname, me.tenant.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerModule(null)
  }

  const openModule = (module: NavModule) => {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches
    if (isMobile && itemsOf(module).length > 1) {
      setDrawerModule(module)
      return
    }
    const first = itemsOf(module)[0]
    const target = lastVisited.current.get(`${me.tenant.id}:${module.key}`) ?? first?.to
    if (target) navigate(target)
    closeDrawer()
  }

  const toggleMenu = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      if (drawerOpen) closeDrawer()
      else setDrawerOpen(true)
    } else {
      setPanelCollapsed(!panelCollapsed)
    }
  }

  const panelModule = (drawerOpen && drawerModule) || location?.module
  // Módulo de uma tela só não tem o que escolher: sem painel.
  const panelUseful = !!panelModule && itemsOf(panelModule).length > 1

  return (
    <RealtimeProvider key={me.tenant.id}>
      <div className="flex h-svh flex-col">
        <TopBar onMenu={toggleMenu} onSearch={() => setPaletteOpen(true)} />

        <div className="relative flex min-h-0 flex-1">
          <div
            className={cn(
              'flex shrink-0',
              'max-md:fixed max-md:top-12 max-md:bottom-0 max-md:left-0 max-md:z-30 max-md:transition-transform max-md:duration-200',
              !drawerOpen && 'max-md:-translate-x-full',
            )}
          >
            <ModuleRail
              modules={modules}
              current={panelModule?.key}
              compact={railCompact}
              onCompactChange={setRailCompact}
              onSelect={openModule}
            />
            {panelModule && panelUseful && (
              <div className={cn(panelCollapsed && 'md:hidden')}>
                <ModulePanel
                  module={panelModule}
                  onCollapse={drawerOpen ? undefined : () => setPanelCollapsed(true)}
                  onNavigate={closeDrawer}
                />
              </div>
            )}
          </div>

          {drawerOpen && (
            <div
              aria-hidden
              onClick={closeDrawer}
              className="fixed inset-x-0 top-12 bottom-0 z-20 bg-black/40 md:hidden"
            />
          )}

          <main
            className={cn(
              'min-h-0 min-w-0 flex-1',
              fullBleed ? 'flex flex-col' : 'overflow-y-auto',
            )}
          >
            {fullBleed ? (
              <Outlet />
            ) : (
              <div className="px-4 pt-2.5 pb-8 md:px-5">
                {location && <Breadcrumbs location={location} pathname={pathname} />}
                <div className="mt-1.5">
                  <Outlet />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <CommandPalette modules={modules} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </RealtimeProvider>
  )
}

/** Metadados que uma rota pode declarar em `handle`. */
export interface RouteHandle {
  fullBleed?: boolean
}
