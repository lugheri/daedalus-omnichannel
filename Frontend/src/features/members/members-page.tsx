import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMe, useSession } from '@/features/auth/session-context'
import { useRoles } from '@/features/roles/api'
import { errorMessage } from '@/lib/api/api-error'
import {
  invitationsQueryKey,
  membersApi,
  membersQueryKey,
  useInvitations,
  useMembers,
  type Member,
} from './api'
import { InviteDialog } from './invite-dialog'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export function MembersPage() {
  const me = useMe()
  const { reload } = useSession()
  const members = useMembers()
  const invitations = useInvitations()
  const roles = useRoles()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)

  const onError = (error: unknown) => toast.error(errorMessage(error))
  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: membersQueryKey })

  const changeRole = useMutation({
    mutationFn: ({ member, roleId }: { member: Member; roleId: string }) =>
      membersApi.changeRole(member.id, roleId),
    onSuccess: async (_, { member }) => {
      toast.success(`Cargo de ${member.user.name} alterado.`)
      await refreshMembers()
      if (member.user.id === me.user.id) await reload()
    },
    onError,
  })

  const toggleStatus = useMutation({
    mutationFn: (member: Member) =>
      member.status === 'active' ? membersApi.disable(member.id) : membersApi.enable(member.id),
    onSuccess: (_, member) => {
      toast.success(
        member.status === 'active'
          ? `${member.user.name} foi desativado(a) e desconectado(a).`
          : `${member.user.name} foi reativado(a).`,
      )
      void refreshMembers()
    },
    onError,
  })

  const revoke = useMutation({
    mutationFn: membersApi.revokeInvitation,
    onSuccess: () => {
      toast.success('Convite revogado.')
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey })
    },
    onError,
  })

  const roleName = (roleId: string) => roles.data?.find((r) => r.id === roleId)?.name ?? '—'

  return (
    <>
      <PageHeader
        title="Membros"
        description="Quem tem acesso a esta conta e com qual cargo."
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus />
            Convidar
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Desde</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.isPending && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {members.data?.map((member) => {
              const isMe = member.user.id === me.user.id
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="font-medium">
                      {member.user.name}{' '}
                      {isMe && <span className="text-muted-foreground">(você)</span>}
                    </div>
                    <div className="text-muted-foreground text-xs">{member.user.email}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role.id}
                      disabled={changeRole.isPending}
                      onValueChange={(roleId) => changeRole.mutate({ member, roleId })}
                    >
                      <SelectTrigger className="w-40" aria-label={`Cargo de ${member.user.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.data?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === 'active' ? 'success' : 'outline'}>
                      {member.status === 'active' ? 'Ativo' : 'Desativado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {dateFormat.format(new Date(member.joinedAt))}
                  </TableCell>
                  <TableCell>
                    {!isMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Ações">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => toggleStatus.mutate(member)}>
                            {member.status === 'active' ? 'Desativar acesso' : 'Reativar acesso'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!!invitations.data?.length && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Convites pendentes</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.data.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>{roleName(invitation.roleId)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormat.format(new Date(invitation.expiresAt))}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Revogar convite de ${invitation.email}`}
                        onClick={() => revoke.mutate(invitation.id)}
                      >
                        <X />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <InviteDialog open={inviting} onOpenChange={setInviting} />
    </>
  )
}
