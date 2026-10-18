import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
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
  FEATURE_LABELS,
  formatLimit,
  LIMIT_LABELS,
  PLAN_FEATURES,
  PLAN_LIMITS,
  planKeys,
  plansApi,
  usePlans,
  type Plan,
} from './api'
import { PlanDialog } from './plan-dialog'

/** Catálogo de planos (só na conta da plataforma). */
export function PlansPage() {
  const queryClient = useQueryClient()
  const plans = usePlans()
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: planKeys.all })

  const act = useMutation({
    mutationFn: ({ plan, action }: { plan: Plan; action: 'default' | 'archive' | 'unarchive' }) =>
      action === 'default'
        ? plansApi.setDefault(plan.id)
        : plansApi.update(plan.id, { archived: action === 'archive' }),
    onSuccess: (plan, { action }) => {
      toast.success(
        action === 'default'
          ? `${plan.name} agora é o plano padrão.`
          : action === 'archive'
            ? `${plan.name} arquivado: sai da escolha, quem usa continua.`
            : `${plan.name} de volta à escolha.`,
      )
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (plan: Plan) => plansApi.remove(plan.id),
    onSuccess: () => {
      toast.success('Plano excluído.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Planos"
        description="O que cada conta pode ter e usar. Quem não tem plano escolhido fica no padrão."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus />
            Novo plano
          </Button>
        }
      />
      <div className="bg-card overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead className="hidden md:table-cell">Limites</TableHead>
              <TableHead className="hidden lg:table-cell">Recursos</TableHead>
              <TableHead className="text-right">Contas</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.isPending && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {plans.data?.map((plan) => (
              <TableRow key={plan.id} className={plan.archived ? 'opacity-60' : ''}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">
                    {plan.name}
                    {plan.isDefault && <Badge variant="success">Padrão</Badge>}
                    {plan.resellable && <Badge variant="secondary">Revenda</Badge>}
                    {plan.archived && <Badge variant="outline">Arquivado</Badge>}
                  </div>
                  {plan.description && (
                    <p className="text-muted-foreground max-w-xs text-xs">{plan.description}</p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                  {PLAN_LIMITS.filter((l) => plan.limits[l] !== null)
                    .map((l) => `${LIMIT_LABELS[l].label}: ${formatLimit(plan.limits[l])}`)
                    .join(' · ') || 'Sem limites'}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                  {PLAN_FEATURES.every((f) => plan.features[f])
                    ? 'Todos'
                    : PLAN_FEATURES.filter((f) => plan.features[f])
                        .map((f) => FEATURE_LABELS[f])
                        .join(' · ') || 'Nenhum'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{plan.accounts ?? 0}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ações do plano ${plan.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(plan)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      {!plan.isDefault && !plan.archived && (
                        <DropdownMenuItem onSelect={() => act.mutate({ plan, action: 'default' })}>
                          <Star />
                          Tornar padrão
                        </DropdownMenuItem>
                      )}
                      {!plan.isDefault &&
                        (plan.archived ? (
                          <DropdownMenuItem
                            onSelect={() => act.mutate({ plan, action: 'unarchive' })}
                          >
                            <ArchiveRestore />
                            Desarquivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => act.mutate({ plan, action: 'archive' })}
                          >
                            <Archive />
                            Arquivar
                          </DropdownMenuItem>
                        ))}
                      {!plan.isDefault && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={(plan.accounts ?? 0) > 0}
                            onSelect={() => setDeleting(plan)}
                          >
                            <Trash2 />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <PlanDialog
          key={editing === 'new' ? 'new' : editing.id}
          plan={editing === 'new' ? undefined : editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o plano {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só plano sem nenhuma conta. Para tirar da escolha sem excluir, arquive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
