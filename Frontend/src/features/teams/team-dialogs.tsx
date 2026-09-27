import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { useMemberDirectory } from '@/features/members/api'
import { teamsApi, teamsQueryKey, type Team } from './api'

const nameSchema = z.object({ name: z.string().trim().min(1, 'Dê um nome à equipe').max(60) })
type NameForm = z.infer<typeof nameSchema>

/** Criar (sem `team`) ou renomear uma equipe. */
export function TeamNameDialog({
  open,
  team,
  onOpenChange,
}: {
  open: boolean
  team: Team | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    values: { name: team?.name ?? '' },
  })

  const save = useMutation({
    mutationFn: ({ name }: NameForm) =>
      team ? teamsApi.rename(team.id, name) : teamsApi.create(name),
    onSuccess: () => {
      toast.success(team ? 'Equipe renomeada.' : 'Equipe criada.')
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey })
      close(false)
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      form.reset()
      save.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Renomear equipe' : 'Nova equipe'}</DialogTitle>
          <DialogDescription>Ex.: Vendas, Suporte, Financeiro.</DialogDescription>
        </DialogHeader>
        <form id="team-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <TextField form={form} name="name" label="Nome" autoFocus />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="team-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Quem faz parte da equipe: lista de colegas ativos com caixas de seleção. */
export function TeamMembersDialog({
  team,
  onOpenChange,
}: {
  team: Team | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const directory = useMemberDirectory()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Ao abrir outra equipe, começa da seleção atual dela.
  if (team && loadedFor !== team.id) {
    setLoadedFor(team.id)
    setSelected(new Set(team.memberIds))
  }

  const save = useMutation({
    mutationFn: () => teamsApi.setMembers(team!.id, [...selected]),
    onSuccess: () => {
      toast.success('Membros atualizados.')
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey })
      close()
    },
  })

  const close = () => {
    setLoadedFor(null)
    save.reset()
    onOpenChange(false)
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Dialog open={team !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Membros de {team?.name}</DialogTitle>
          <DialogDescription>
            Atendentes veem a fila das suas equipes; supervisores, todas as conversas delas.
          </DialogDescription>
        </DialogHeader>
        <FormError error={save.error} />
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto py-1">
          {directory.data?.map((member) => (
            <div key={member.membershipId} className="flex items-center gap-3">
              <Checkbox
                id={`member-${member.membershipId}`}
                checked={selected.has(member.membershipId)}
                onCheckedChange={(checked) => toggle(member.membershipId, checked === true)}
              />
              <Label htmlFor={`member-${member.membershipId}`} className="font-normal">
                {member.name}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando…' : `Salvar (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
