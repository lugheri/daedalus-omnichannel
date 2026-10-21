import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useMemberDirectory } from '@/features/members/api'
import { catalogApi, catalogKeys, useProfessionals, useServices, type Professional } from './api'
import { formatDuration } from './format'

const NO_LOGIN = 'none'

/** Criar (sem `professional`) ou editar. Monte com `key` para recomeçar o formulário. */
export function ProfessionalDialog({
  professional,
  open,
  onOpenChange,
}: {
  professional?: Professional
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const services = useServices()
  const professionals = useProfessionals()
  const directory = useMemberDirectory()
  const [name, setName] = useState(professional?.name ?? '')
  const [title, setTitle] = useState(professional?.title ?? '')
  const [bio, setBio] = useState(professional?.bio ?? '')
  const [membershipId, setMembershipId] = useState(professional?.membershipId ?? NO_LOGIN)
  const [serviceIds, setServiceIds] = useState<string[]>(professional?.serviceIds ?? [])
  const [showOnSite, setShowOnSite] = useState(professional?.showOnSite ?? true)
  const [submitted, setSubmitted] = useState(false)

  const nameError = name.trim() ? null : 'Dê o nome do profissional'
  // Quem já é outro profissional não aparece (um membro = um profissional).
  const linkedElsewhere = new Set(
    professionals.data
      ?.filter((p) => p.id !== professional?.id && p.membershipId)
      .map((p) => p.membershipId),
  )
  const members = directory.data?.filter((m) => !linkedElsewhere.has(m.membershipId)) ?? []
  // Inativos só aparecem se já estiverem marcados (para poder desmarcar).
  const serviceOptions = services.data?.filter((s) => s.active || serviceIds.includes(s.id)) ?? []

  const toggleService = (id: string, checked: boolean) =>
    setServiceIds((ids) => (checked ? [...ids, id] : ids.filter((s) => s !== id)))

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name,
        title: title.trim() || null,
        bio: bio.trim() || null,
        membershipId: membershipId === NO_LOGIN ? null : membershipId,
        serviceIds,
        showOnSite,
      }
      return professional
        ? catalogApi.updateProfessional(professional.id, input)
        : catalogApi.createProfessional(input)
    },
    onSuccess: () => {
      toast.success(professional ? 'Profissional atualizado.' : 'Profissional cadastrado.')
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!nameError) save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{professional ? 'Editar profissional' : 'Novo profissional'}</DialogTitle>
          <DialogDescription>
            Quem atende. Não precisa ter login no sistema — só se for usar a agenda pelo celular.
          </DialogDescription>
        </DialogHeader>
        <form id="professional-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={submitted && !!nameError}>
                <FieldLabel htmlFor="professional-name">Nome</FieldLabel>
                <Input
                  id="professional-name"
                  value={name}
                  maxLength={80}
                  autoFocus
                  aria-invalid={submitted && !!nameError}
                  onChange={(event) => setName(event.target.value)}
                />
                {submitted && nameError && <FieldError>{nameError}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="professional-title">Função (opcional)</FieldLabel>
                <Input
                  id="professional-title"
                  value={title}
                  maxLength={60}
                  placeholder="Ex.: Cabeleireira"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="professional-member">Login no sistema</FieldLabel>
              <Select value={membershipId} onValueChange={setMembershipId}>
                <SelectTrigger id="professional-member" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LOGIN}>Sem login (só cadastro)</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.membershipId} value={m.membershipId}>
                      {m.name}
                    </SelectItem>
                  ))}
                  {/* Vinculado a alguém que saiu da conta: continua visível até trocar. */}
                  {membershipId !== NO_LOGIN &&
                    !members.some((m) => m.membershipId === membershipId) && (
                      <SelectItem value={membershipId}>Membro desativado</SelectItem>
                    )}
                </SelectContent>
              </Select>
              <FieldDescription>
                Vincule a um membro da equipe se ele for acompanhar a própria agenda.
              </FieldDescription>
            </Field>

            <FieldSet>
              <FieldLegend variant="label">Serviços que faz</FieldLegend>
              {serviceOptions.length === 0 ? (
                <FieldDescription>Nenhum serviço cadastrado ainda.</FieldDescription>
              ) : (
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {serviceOptions.map((service) => (
                    <div key={service.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`professional-service-${service.id}`}
                        checked={serviceIds.includes(service.id)}
                        onCheckedChange={(checked) => toggleService(service.id, checked === true)}
                      />
                      <Label htmlFor={`professional-service-${service.id}`} className="font-normal">
                        {service.name}
                        <span className="text-faint text-xs">
                          {formatDuration(service.durationMinutes)}
                          {!service.active && ' · inativo'}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="professional-bio">Sobre (opcional)</FieldLabel>
              <Textarea
                id="professional-bio"
                rows={3}
                maxLength={1000}
                value={bio}
                placeholder="Aparece no site, se o profissional for mostrado lá."
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox
                id="professional-on-site"
                checked={showOnSite}
                onCheckedChange={(checked) => setShowOnSite(checked === true)}
              />
              <Label htmlFor="professional-on-site">Mostrar no site</Label>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="professional-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
