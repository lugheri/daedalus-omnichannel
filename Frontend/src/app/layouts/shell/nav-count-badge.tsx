import { cn } from '@/lib/utils'

/**
 * Número de itens que pedem ação (conversas esperando resposta, leads sem
 * responsável) ao lado de um item do menu. O texto para leitor de tela vai em
 * `label` ("3 conversas esperando resposta").
 *
 * Cores: fundo `destructive` com texto `primary-foreground` — branco sobre o
 * vermelho no tema claro e escuro sobre o vermelho claro no escuro, o mesmo par
 * de contraste que o tema usa no botão primário. Destaca também no trilho escuro
 * e no item ativo do painel (que é azul).
 */
export function NavCountBadge({
  count,
  label,
  className,
}: {
  count: number
  label: string
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      title={label}
      className={cn(
        'bg-destructive text-primary-foreground inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums',
        className,
      )}
    >
      <span aria-hidden>{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
