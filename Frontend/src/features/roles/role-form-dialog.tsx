import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
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
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { usePermissions, useSession } from '@/features/auth/session-context'
import { rolesApi, rolesQueryKey, type Role } from './api'
import { OWNER_ONLY_PERMISSION, PERMISSION_GROUPS } from './permissions'

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(50),
  permissions: z.array(z.string()),
})
type RoleForm = z.infer<typeof schema>

/** Cria (sem `role`) ou edita um cargo. */
export function RoleFormDialog({
  role,
  open,
  onOpenChange,
}: {
  role?: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { reload } = useSession()
  const { can } = usePermissions()
  const form = useForm<RoleForm>({
    resolver: zodResolver(schema),
    values: { name: role?.name ?? '', permissions: role?.permissions ?? [] },
  })

  const save = useMutation({
    mutationFn: (values: RoleForm) =>
      role ? rolesApi.update(role.id, values) : rolesApi.create(values),
    onSuccess: async () => {
      toast.success(role ? 'Cargo atualizado.' : 'Cargo criado.')
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey })
      await reload() // se for o seu cargo, as suas permissões mudaram
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? `Editar ${role.name}` : 'Novo cargo'}</DialogTitle>
          <DialogDescription>
            Permissões que você não tem aparecem desabilitadas: ninguém concede o que não possui.
          </DialogDescription>
        </DialogHeader>
        <form id="role-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <TextField form={form} name="name" label="Nome do cargo" autoFocus />
            <Controller
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <>
                  {PERMISSION_GROUPS.map((group) => (
                    <FieldSet key={group.label}>
                      <FieldLegend variant="label">{group.label}</FieldLegend>
                      {group.permissions
                        .filter((p) => p.key !== OWNER_ONLY_PERMISSION)
                        .map((permission) => (
                          <div key={permission.key} className="flex items-center gap-2">
                            <Checkbox
                              id={permission.key}
                              checked={field.value.includes(permission.key)}
                              disabled={!can(permission.key)}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked
                                    ? [...field.value, permission.key]
                                    : field.value.filter((p) => p !== permission.key),
                                )
                              }
                            />
                            <Label htmlFor={permission.key} className="font-normal">
                              {permission.label}
                            </Label>
                          </div>
                        ))}
                    </FieldSet>
                  ))}
                </>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
