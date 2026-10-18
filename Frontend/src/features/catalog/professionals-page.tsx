import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  Globe,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-react'
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
import { ScheduleDialog } from '@/features/agenda/schedule-dialog'
import { useMemberNames } from '@/features/members/api'
import { errorMessage } from '@/lib/api/api-error'
import { catalogApi, catalogKeys, useProfessionals, useServices, type Professional } from './api'
import { ProfessionalDialog } from './professional-dialog'

export function ProfessionalsPage() {
  const queryClient = useQueryClient()
  const professionals = useProfessionals()
  const services = useServices()
  const memberName = useMemberNames()
  const [editing, setEditing] = useState<Professional | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Professional | null>(null)
  const [scheduling, setScheduling] = useState<Professional | null>(null)
  const items = [...(professionals.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active))
  const serviceNames = (ids: string[]) =>
    services.data
      ?.filter((s) => ids.includes(s.id))
      .map((s) => s.name)
      .join(', ')

  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.all })

  const toggle = useMutation({
    mutationFn: (p: Professional) => catalogApi.updateProfessional(p.id, { active: !p.active }),
    onSuccess: (p) => {
      toast.success(p.active ? 'Profissional reativado.' : 'Profissional desativado.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (p: Professional) => catalogApi.removeProfessional(p.id),
    onSuccess: () => {
      toast.success('Profissional excluído.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Quem atende, quais serviços faz e em que horários. Não precisa ter login no sistema."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus />
            Novo profissional
          </Button>
        }
      />

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead>Serviços</TableHead>
              <TableHead className="hidden md:table-cell">Login</TableHead>
              <TableHead className="hidden sm:table-cell">Situação</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {professionals.isPending && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {items.length === 0 && !professionals.isPending && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  Nenhum profissional ainda. Cadastre quem atende para montar a agenda.
                </TableCell>
              </TableRow>
            )}
            {items.map((professional) => (
              <TableRow key={professional.id} className={professional.active ? '' : 'opacity-60'}>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium">
                    {professional.name}
                    {professional.showOnSite && professional.active && (
                      <span role="img" aria-label="Aparece no site" title="Aparece no site">
                        <Globe className="text-faint size-3.5" />
                      </span>
                    )}
                  </div>
                  {professional.title && (
                    <p className="text-muted-foreground text-xs">{professional.title}</p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {serviceNames(professional.serviceIds) || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {professional.membershipId ? (
                    <span className="inline-flex items-center gap-1">
                      <KeyRound className="size-3.5" />
                      {memberName(professional.membershipId) ?? 'Membro desativado'}
                    </span>
                  ) : (
                    'Sem login'
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={professional.active ? 'success' : 'outline'}>
                    {professional.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ações de ${professional.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(professional)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setScheduling(professional)}>
                        <Clock />
                        Horários e bloqueios
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toggle.mutate(professional)}>
                        {professional.active ? <PowerOff /> : <Power />}
                        {professional.active ? 'Desativar' : 'Reativar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleting(professional)}
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

      {editing !== null && (
        <ProfessionalDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          professional={editing === 'new' ? undefined : editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      {scheduling && (
        <ScheduleDialog
          key={scheduling.id}
          professional={scheduling}
          onOpenChange={(open) => !open && setScheduling(null)}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro sai do sistema. Se a pessoa só está afastada, desative: ela sai das opções
              e pode voltar depois. O login dela (se tiver) não muda.
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
