import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Trophy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api/api-error'
import {
  landingApi,
  landingKeys,
  useLandingStats,
  type LandingPage,
  type VariantStats,
} from './api'
import { formatRate } from './landing-format'

const signed = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

function Comparison({ stats }: { stats: VariantStats }) {
  const c = stats.comparison
  if (!c) return <span className="text-muted-foreground text-xs">referência</span>
  const lift = c.lift === null ? '' : signed.format(c.lift)
  if (c.verdict === 'insufficient') {
    return (
      <span
        className="text-muted-foreground text-xs"
        title="Mínimo de 100 visitas em cada variante"
      >
        {lift && `${lift} · `}poucas visitas
      </span>
    )
  }
  if (c.verdict === 'inconclusive') {
    return (
      <span className="text-muted-foreground text-xs" title="A diferença ainda pode ser sorte">
        {lift && `${lift} · `}sem diferença confiável
      </span>
    )
  }
  return (
    <Badge variant={c.verdict === 'better' ? 'success' : 'destructive'}>{lift} · confiável</Badge>
  )
}

/**
 * Teste A/B: quanto do tráfego vai para cada variante (o peso, salvo com as
 * outras alterações) e os números de cada uma, comparados com a A. Escolher
 * a vencedora deixa só ela no ar.
 */
export function AbTestPanel({
  page,
  weights,
  onWeightChange,
  busy,
}: {
  page: LandingPage
  weights: Record<string, number>
  onWeightChange: (variantId: string, weight: number) => void
  busy: boolean
}) {
  const queryClient = useQueryClient()
  const stats = useLandingStats(page.id)
  const [winner, setWinner] = useState<VariantStats | null>(null)
  const [resetting, setResetting] = useState(false)
  const total = page.variants.reduce((sum, v) => sum + (weights[v.id] ?? v.weight), 0)
  const byId = new Map((stats.data ?? []).map((s) => [s.variantId, s]))

  const refresh = (next?: LandingPage) => {
    if (next) queryClient.setQueryData(landingKeys.page(page.id), next)
    void queryClient.invalidateQueries({ queryKey: landingKeys.all })
  }
  const choose = useMutation({
    mutationFn: (variantId: string) => landingApi.chooseWinner(page.id, variantId),
    onSuccess: (next) => {
      refresh(next)
      toast.success(
        next.isLive
          ? 'Vencedora escolhida. Publicando: em instantes só ela fica no ar.'
          : 'Vencedora escolhida. Publique para valer.',
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const reset = useMutation({
    mutationFn: () => landingApi.resetStats(page.id),
    onSuccess: () => {
      refresh()
      toast.success('Contagem recomeçada.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <section
      aria-labelledby="ab-title"
      className="bg-card flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="ab-title" className="font-semibold">
            {page.variants.length > 1 ? 'Teste A/B' : 'Resultados'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {page.variants.length > 1
              ? 'Cada visitante vê sempre a mesma variante, sorteada pelo peso. Conversão = formulário enviado.'
              : 'Crie uma variante (cópia desta) e mude o que quer testar: a chamada, a oferta, a imagem…'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={reset.isPending}
          onClick={() => setResetting(true)}
        >
          <RotateCcw />
          Recomeçar contagem
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              {page.variants.length > 1 && <TableHead>Peso</TableHead>}
              <TableHead className="text-right">Visitas</TableHead>
              <TableHead className="text-right">Conversões</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
              {page.variants.length > 1 && <TableHead>Comparada à A</TableHead>}
              {page.variants.length > 1 && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.variants.map((variant) => {
              const weight = weights[variant.id] ?? variant.weight
              const numbers = byId.get(variant.id)
              return (
                <TableRow key={variant.id} className={weight === 0 ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">
                    {variant.code.toUpperCase()} · {variant.name}
                  </TableCell>
                  {page.variants.length > 1 && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-8 w-20"
                          aria-label={`Peso da variante ${variant.code.toUpperCase()}`}
                          value={weight}
                          onChange={(event) =>
                            onWeightChange(
                              variant.id,
                              Math.max(
                                0,
                                Math.min(100, Math.round(Number(event.target.value) || 0)),
                              ),
                            )
                          }
                        />
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {total > 0 ? formatRate(weight / total) : '—'}
                        </span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {stats.isPending ? '…' : (numbers?.views ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.isPending ? '…' : (numbers?.conversions ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.isPending ? '…' : formatRate(numbers?.rate ?? null)}
                  </TableCell>
                  {page.variants.length > 1 && (
                    <TableCell>{numbers && <Comparison stats={numbers} />}</TableCell>
                  )}
                  {page.variants.length > 1 && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Escolher a variante ${variant.code.toUpperCase()} como vencedora`}
                        title="Escolher como vencedora"
                        disabled={busy || choose.isPending || !numbers}
                        onClick={() => numbers && setWinner(numbers)}
                      >
                        <Trophy />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {total === 0 && (
        <p role="alert" className="text-destructive text-sm">
          Dê peso a pelo menos uma variante.
        </p>
      )}

      <AlertDialog open={winner !== null} onOpenChange={(open) => !open && setWinner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Escolher a variante {winner?.code.toUpperCase()} como vencedora?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ela fica com todo o tráfego (as outras ficam guardadas, com peso 0, e os números
              continuam aqui).{page.isLive && ' A página é publicada de novo na hora.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => winner && choose.mutate(winner.variantId)}>
              Escolher
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={resetting} onOpenChange={setResetting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recomeçar a contagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga as visitas e conversões de todas as variantes desta página. Útil quando você
              muda uma variante no meio do teste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => reset.mutate()}>
              Recomeçar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
