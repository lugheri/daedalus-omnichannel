import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMemberDirectory } from '@/features/members/api'
import { useTeams } from '@/features/teams/api'
import { conversationKeys, conversationsApi, type Conversation } from './api'

/** O Select do Radix não aceita valor vazio: "nenhum" usa este marcador. */
const NONE = 'none'

/**
 * Transferir para uma equipe e/ou uma pessoa. Trocar só a equipe devolve a
 * conversa para a fila dela (sem responsável).
 */
export function TransferDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: Conversation
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const teams = useTeams(open)
  const directory = useMemberDirectory()
  const [teamId, setTeamId] = useState(conversation.team?.id ?? NONE)
  const [assigneeId, setAssigneeId] = useState(conversation.assigneeId ?? NONE)

  const teamChanged = teamId !== (conversation.team?.id ?? NONE)
  const assigneeChanged = assigneeId !== (conversation.assigneeId ?? NONE)

  const transfer = useMutation({
    mutationFn: () =>
      conversationsApi.transfer(conversation.id, {
        ...(teamChanged && { teamId: teamId === NONE ? null : teamId }),
        ...((assigneeChanged || teamChanged) && {
          // Mudou a equipe e manteve a pessoa: a pessoa segue responsável.
          assigneeId: assigneeId === NONE ? null : assigneeId,
        }),
      }),
    onSuccess: () => {
      toast.success('Conversa transferida.')
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all })
      onOpenChange(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) transfer.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <DialogDescription>
            Escolha a equipe e, se quiser, a pessoa responsável. Sem responsável, a conversa fica na
            fila da equipe.
          </DialogDescription>
        </DialogHeader>
        <FormError error={transfer.error} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-team">Equipe</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="transfer-team" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Fila geral (sem equipe)</SelectItem>
                {teams.data?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-assignee">Responsável</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger id="transfer-assignee" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável (fila)</SelectItem>
                {directory.data?.map((member) => (
                  <SelectItem key={member.membershipId} value={member.membershipId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={transfer.isPending || (!teamChanged && !assigneeChanged)}
            onClick={() => transfer.mutate()}
          >
            {transfer.isPending ? 'Transferindo…' : 'Transferir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
