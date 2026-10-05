import { useMemo } from 'react'
import { Link } from 'react-router'
import { itemsOf, visibleModules } from '@/app/navigation'
import { PageHeader } from '@/components/page-header'
import { useMe, usePermissions } from '@/features/auth/session-context'

export function HomePage() {
  const me = useMe()
  const { canAny } = usePermissions()
  const modules = useMemo(
    () => visibleModules(canAny).filter((module) => module.key !== 'home'),
    [canAny],
  )

  return (
    <>
      <PageHeader
        title={`Olá, ${me.user.name.split(' ')[0]}`}
        description={`Você está em ${me.tenant.name} como ${me.role.name}.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon
          return (
            <section
              key={module.key}
              aria-labelledby={`module-${module.key}`}
              className="bg-card rounded-lg border p-3.5 shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 id={`module-${module.key}`} className="truncate text-sm font-semibold">
                    {module.label}
                  </h2>
                  <p className="text-faint truncate text-xs">{module.description}</p>
                </div>
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {itemsOf(module).map(({ to, label, icon: ItemIcon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="bg-secondary text-secondary-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                    >
                      <ItemIcon className="size-3.5 opacity-70" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
