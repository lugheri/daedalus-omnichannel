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
import { usePermissions } from '@/features/auth/session-context'
import { useTeams } from '@/features/teams/api'
import { channelsApi, channelsQueryKey, type Channel } from './api'

/** O Select do Radix não aceita valor vazio: "sem equipe" usa este marcador. */
const NO_TEAM = 'none'

/** Equipe que recebe as conversas NOVAS do canal. */
export function ChannelTeamDialog({
  channel,
  onOpenChange,
}: {
  channel: Channel | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { canAny } = usePermissions()
  const teams = useTeams(canAny('teams:manage', 'conversations:assign'))
  const [value, setValue] = useState<string | null>(null)
  const selected = value ?? channel?.teamId ?? NO_TEAM

  const save = useMutation({
    mutationFn: () => channelsApi.setTeam(channel!.id, selected === NO_TEAM ? null : selected),
    onSuccess: () => {
      toast.success('Equipe do canal atualizada.')
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey, exact: true })
      close()
    },
  })

  const close = () => {
    setValue(null)
    save.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={channel !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Equipe do canal {channel?.name}</DialogTitle>
          <DialogDescription>
            As conversas novas deste número entram na fila da equipe. As que já existem continuam
            onde estão.
          </DialogDescription>
        </DialogHeader>
        <FormError error={save.error} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="channel-team">Equipe</Label>
          <Select value={selected} onValueChange={setValue}>
            <SelectTrigger id="channel-team" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEAM}>Sem equipe (fila geral)</SelectItem>
              {teams.data?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
