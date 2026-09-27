import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Plus } from 'lucide-react'
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
import { useMemberNames } from '@/features/members/api'
import { errorMessage } from '@/lib/api/api-error'
import { teamsApi, teamsQueryKey, useTeams, type Team } from './api'
import { TeamMembersDialog, TeamNameDialog } from './team-dialogs'

export function TeamsPage() {
  const queryClient = useQueryClient()
  const teams = useTeams()
  const nameOf = useMemberNames()
  const [editing, setEditing] = useState<Team | null>(null)
  const [creating, setCreating] = useState(false)
  const [membersOf, setMembersOf] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState<Team | null>(null)

  const remove = useMutation({
    mutationFn: (team: Team) => teamsApi.remove(team.id),
    onSuccess: () => {
      toast.success('Equipe excluída.')
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Equipes"
        description="Agrupe atendentes por área. Cada canal pode mandar as conversas para uma equipe."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Nova equipe
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipe</TableHead>
              <TableHead>Membros</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.isPending && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {teams.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                  Nenhuma equipe ainda. Sem equipes, todas as conversas ficam numa fila geral.
                </TableCell>
              </TableRow>
            )}
            {teams.data?.map((team) => {
              const names = team.memberIds.map(nameOf).filter(Boolean)
              return (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">
                    {names.length ? names.join(', ') : 'Nenhum membro'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Ações de ${team.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setMembersOf(team)}>
                          Definir membros
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(team)}>
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(team)}>
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TeamNameDialog
        open={creating || editing !== null}
        team={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
      />
      <TeamMembersDialog team={membersOf} onOpenChange={() => setMembersOf(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a equipe {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os canais e as conversas dela passam para a fila geral. Os responsáveis das conversas
              são mantidos.
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
