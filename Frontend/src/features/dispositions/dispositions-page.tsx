import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { dispositionsApi, dispositionsQueryKey, useDispositions, type Disposition } from './api'
import { DispositionBadge } from './disposition-badge'
import { DispositionFormDialog } from './disposition-form-dialog'

export function DispositionsPage() {
  const queryClient = useQueryClient()
  const dispositions = useDispositions()
  const [editing, setEditing] = useState<Disposition | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Disposition | null>(null)
  // Ativas primeiro; dentro de cada grupo, por nome (a API já ordena).
  const items = [...(dispositions.data ?? [])].sort(
    (a, b) => Number(a.archived) - Number(b.archived),
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: dispositionsQueryKey })

  const archive = useMutation({
    mutationFn: (d: Disposition) => dispositionsApi.update(d.id, { archived: !d.archived }),
    onSuccess: (d) => {
      toast.success(d.archived ? 'Tabulação arquivada.' : 'Tabulação reativada.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (d: Disposition) => dispositionsApi.remove(d.id),
    onSuccess: () => {
      toast.success('Tabulação excluída.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Tabulações"
        description="Como cada atendimento terminou (ou em que pé está). Com ao menos uma ativa, resolver uma conversa pede a tabulação."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus />
            Nova tabulação
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tabulação</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispositions.isPending && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {items.length === 0 && !dispositions.isPending && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                  Nenhuma tabulação ainda. Sem tabulações, as conversas são resolvidas sem
                  classificação.
                </TableCell>
              </TableRow>
            )}
            {items.map((disposition) => (
              <TableRow key={disposition.id} className={disposition.archived ? 'opacity-60' : ''}>
                <TableCell>
                  <DispositionBadge disposition={disposition} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {disposition.archived ? 'Arquivada' : 'Ativa'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ações de ${disposition.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(disposition)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => archive.mutate(disposition)}>
                        {disposition.archived ? <ArchiveRestore /> : <Archive />}
                        {disposition.archived ? 'Reativar' : 'Arquivar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(disposition)}
                      >
                        <Trash2 />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DispositionFormDialog
        open={editing !== null}
        disposition={editing === 'new' || editing === null ? undefined : editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a tabulação {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só dá para excluir uma tabulação que nunca foi usada. Se ela já classificou algum
              atendimento, arquive: ela sai das opções e continua no histórico.
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
