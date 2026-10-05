import type { ReactNode } from 'react'

/** Título da página, descrição opcional e ações à direita. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[21px] font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-0.5 text-[13px]">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
