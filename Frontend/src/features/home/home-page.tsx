import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NAV_ITEMS } from '@/app/navigation'
import { useMe, usePermissions } from '@/features/auth/session-context'

export function HomePage() {
  const me = useMe()
  const { canAny } = usePermissions()
  const shortcuts = NAV_ITEMS.filter((item) => item.to !== '/' && canAny(...item.anyOf))

  return (
    <>
      <PageHeader
        title={`Olá, ${me.user.name.split(' ')[0]}`}
        description={`Você está em ${me.tenant.name} como ${me.role.name}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <Icon className="text-primary mb-2 size-5" />
                <CardTitle>{label}</CardTitle>
                <CardDescription>Abrir {label.toLowerCase()}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
