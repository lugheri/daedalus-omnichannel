import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Disposition } from './api'
import { DISPOSITION_STYLES } from './colors'

/** Etiqueta colorida de uma tabulação. */
export function DispositionBadge({
  disposition,
  className,
}: {
  disposition: Pick<Disposition, 'name' | 'color'>
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn('max-w-full truncate', DISPOSITION_STYLES[disposition.color].badge, className)}
    >
      {disposition.name}
    </Badge>
  )
}
