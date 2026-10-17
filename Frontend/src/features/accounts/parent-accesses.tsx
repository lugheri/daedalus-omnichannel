import { useMe, usePermissions } from '@/features/auth/session-context'
import { useParentAccesses } from './api'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Quem da conta-mãe entrou nesta conta, e quando (transparência para o
 * cliente: ADR 0009). Só aparece em conta gerenciada por outra.
 */
export function ParentAccesses() {
  const me = useMe()
  const { can } = usePermissions()
  const show = !!me.parent && can('members:manage')
  const accesses = useParentAccesses(show)
  if (!show) return null

  return (
    <section aria-labelledby="parent-accesses-title" className="mt-8 flex flex-col gap-2">
      <h2 id="parent-accesses-title" className="font-semibold">
        Acessos da conta-mãe
      </h2>
      <p className="text-muted-foreground text-sm">
        Esta conta é gerenciada por <strong>{me.parent!.name}</strong>. Quem de lá entra aqui pode
        configurar e operar como um Admin; cada entrada fica registrada abaixo.
      </p>
      {accesses.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">Ninguém da conta-mãe entrou ainda.</p>
      )}
      <ul className="divide-y rounded-md border text-sm">
        {accesses.data?.map((a, index) => (
          <li key={index} className="flex flex-wrap justify-between gap-2 px-3 py-2">
            <span>
              <strong>{a.userName}</strong>
              <span className="text-muted-foreground"> · {a.fromAccountName}</span>
            </span>
            <span className="text-muted-foreground">{dateTime.format(new Date(a.createdAt))}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
