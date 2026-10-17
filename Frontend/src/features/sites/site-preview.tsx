import { Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Prévia do site num iframe isolado: `sandbox="allow-scripts"` sem
 * `allow-same-origin` dá ao documento uma origem opaca (o script do modelo
 * não alcança o painel nem a sessão) e, sem `allow-forms`, o formulário não
 * envia. Alterna entre largura de computador e de celular.
 */
export function SitePreview({
  html,
  loading = false,
  title = 'Prévia do site',
  className,
}: {
  html: string | null
  loading?: boolean
  title?: string
  className?: string
}) {
  const [mobile, setMobile] = useState(false)

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {loading ? 'Atualizando a prévia…' : 'Prévia (o formulário não envia aqui)'}
        </span>
        <div className="flex gap-1" role="group" aria-label="Largura da prévia">
          <Button
            size="icon"
            variant={mobile ? 'ghost' : 'secondary'}
            aria-label="Prévia no computador"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            <Monitor />
          </Button>
          <Button
            size="icon"
            variant={mobile ? 'secondary' : 'ghost'}
            aria-label="Prévia no celular"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            <Smartphone />
          </Button>
        </div>
      </div>
      <div className="bg-muted flex min-h-[480px] flex-1 justify-center overflow-hidden rounded-md border">
        {html === null ? (
          <Skeleton className="m-4 h-[440px] w-full" />
        ) : (
          <iframe
            title={title}
            sandbox="allow-scripts"
            srcDoc={html}
            className={cn(
              'h-full min-h-[480px] bg-white transition-[width]',
              mobile ? 'w-[390px] max-w-full border-x' : 'w-full',
            )}
          />
        )}
      </div>
    </div>
  )
}
