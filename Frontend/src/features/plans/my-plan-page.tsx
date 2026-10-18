import { Check, X } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/api-error'
import { cn } from '@/lib/utils'
import { FEATURE_LABELS, LIMIT_LABELS, PLAN_FEATURES, PLAN_LIMITS, usePlanUsage } from './api'

/** O plano da conta e quanto ela já usa de cada limite. */
export function MyPlanPage() {
  const usage = usePlanUsage()

  return (
    <>
      <PageHeader
        title="Meu plano"
        description="O que a conta pode ter e usar. Para mudar de plano, fale com quem gerencia a sua conta."
      />
      {usage.isPending && <Skeleton className="h-64" />}
      {usage.isError && <p className="text-destructive text-sm">{errorMessage(usage.error)}</p>}
      {usage.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="plan-limits" className="bg-card rounded-md border p-4">
            <h2 id="plan-limits" className="font-semibold">
              {usage.data.plan.unlimited
                ? 'Conta da plataforma: sem limites'
                : `Plano ${usage.data.plan.name ?? ''}`}
            </h2>
            {usage.data.plan.description && (
              <p className="text-muted-foreground mt-1 text-sm">{usage.data.plan.description}</p>
            )}
            <ul className="mt-4 flex flex-col gap-4" aria-label="Uso dos limites">
              {PLAN_LIMITS.map((limit) => {
                const max = usage.data.plan.limits[limit]
                const used = usage.data.usage[limit]
                const share = max === null ? 0 : max === 0 ? 1 : Math.min(used / max, 1)
                const full = max !== null && used >= max
                return (
                  <li key={limit} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span>{LIMIT_LABELS[limit].label}</span>
                      <span className={cn('tabular-nums', full && 'text-destructive font-medium')}>
                        {max === null ? `${used} · sem limite` : `${used} de ${max}`}
                      </span>
                    </div>
                    {max !== null && (
                      <div
                        className="bg-muted h-2 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-label={LIMIT_LABELS[limit].label}
                        aria-valuemin={0}
                        aria-valuemax={max}
                        aria-valuenow={Math.min(used, max)}
                      >
                        <div
                          className={cn('h-full', full ? 'bg-destructive' : 'bg-primary')}
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
          <section aria-labelledby="plan-features" className="bg-card rounded-md border p-4">
            <h2 id="plan-features" className="font-semibold">
              Recursos
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {PLAN_FEATURES.map((feature) => {
                const included = usage.data.plan.features[feature]
                return (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <span
                      role="img"
                      aria-label={included ? 'Incluso' : 'Não incluso'}
                      className={included ? 'text-success' : 'text-faint'}
                    >
                      {included ? <Check className="size-4" /> : <X className="size-4" />}
                    </span>
                    <span className={included ? '' : 'text-muted-foreground'}>
                      {FEATURE_LABELS[feature]}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </>
  )
}
