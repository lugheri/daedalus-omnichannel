import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORM_KIND_LABEL, formKeys, formsApi, type FormKind, type SiteForm } from './api'

/** Criar (sem `form`) ou editar as configurações de um formulário. */
export function FormDialog({
  form,
  open,
  onOpenChange,
}: {
  form?: SiteForm
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(form?.name ?? '')
  const [kind, setKind] = useState<FormKind>(form?.kind ?? 'contact')
  const [campaign, setCampaign] = useState(form?.campaign ?? '')
  const [successUrl, setSuccessUrl] = useState(form?.successUrl ?? '')

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name,
        campaign: campaign.trim() || null,
        successUrl: successUrl.trim() || null,
      }
      return form ? formsApi.update(form.id, input) : formsApi.create({ ...input, kind })
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: formKeys.all })
      onOpenChange(false)
      if (form) toast.success('Formulário atualizado.')
      else void navigate(`/forms/${saved.id}`)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form ? 'Configurar formulário' : 'Novo formulário'}</DialogTitle>
          <DialogDescription>
            Cada envio vira contato e abre um negócio nos funis que recebem leads do site.
          </DialogDescription>
        </DialogHeader>
        <form id="site-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <Field>
              <FieldLabel htmlFor="site-form-name">Nome (interno)</FieldLabel>
              <Input
                id="site-form-name"
                autoFocus
                maxLength={80}
                value={name}
                placeholder="Ex.: Contato da página inicial"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            {!form && (
              <Field>
                <FieldLabel htmlFor="site-form-kind">Tipo</FieldLabel>
                <Select value={kind} onValueChange={(v) => setKind(v as FormKind)}>
                  <SelectTrigger id="site-form-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">{FORM_KIND_LABEL.contact}</SelectItem>
                    <SelectItem value="service">{FORM_KIND_LABEL.service}</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {kind === 'service'
                    ? 'A pessoa escolhe um dos serviços marcados "mostrar no site" e diz quando prefere. O negócio já entra com o serviço e o preço.'
                    : 'Nome, telefone ou e-mail e uma mensagem.'}
                </FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="site-form-campaign">Origem dos contatos (opcional)</FieldLabel>
              <Input
                id="site-form-campaign"
                maxLength={80}
                value={campaign}
                placeholder={name.trim() || 'O nome do formulário'}
                onChange={(event) => setCampaign(event.target.value)}
              />
              <FieldDescription>
                Aparece na ficha do contato e filtra o público das campanhas.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="site-form-success">Página de obrigado (opcional)</FieldLabel>
              <Input
                id="site-form-success"
                type="url"
                maxLength={500}
                value={successUrl}
                placeholder="https://suaempresa.com.br/obrigado"
                onChange={(event) => setSuccessUrl(event.target.value)}
              />
              <FieldDescription>
                Vazio = uma página nossa: “Recebemos sua mensagem!”.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="site-form" disabled={!name.trim() || save.isPending}>
            {form ? 'Salvar' : 'Criar formulário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
