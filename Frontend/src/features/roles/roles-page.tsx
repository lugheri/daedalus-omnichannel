import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'
import { rolesApi, rolesQueryKey, useRoles, type Role } from './api'
import { RoleFormDialog } from './role-form-dialog'

export function RolesPage() {
  const roles = useRoles()
  const { can } = usePermissions()
  const canManage = can('roles:manage')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const remove = useMutation({
    mutationFn: (role: Role) => rolesApi.remove(role.id),
    onSuccess: () => {
      toast.success('Cargo excluído.')
      void queryClient.invalidateQueries({ queryKey: rolesQueryKey })
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setDeleting(null),
  })

  return (
    <>
      <PageHeader
        title="Cargos"
        description="Cada cargo define o que seus membros podem fazer nesta conta."
        actions={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Novo cargo
            </Button>
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {roles.isPending &&
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        {roles.data?.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {role.name}
                {role.isSystem && (
                  <Badge variant="secondary">
                    <Lock />
                    Sistema
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {role.permissions.length} permiss{role.permissions.length === 1 ? 'ão' : 'ões'}
              </CardDescription>
              {canManage && !role.isSystem && (
                <CardAction className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${role.name}`}
                    onClick={() => setEditing(role)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Excluir ${role.name}`}
                    onClick={() => setDeleting(role)}
                  >
                    <Trash2 />
                  </Button>
                </CardAction>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      <RoleFormDialog
        role={editing === 'new' ? undefined : (editing ?? undefined)}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o cargo {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir cargos que nenhum membro ou convite pendente usa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
