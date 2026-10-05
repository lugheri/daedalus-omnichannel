import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  messagingApi,
  messagingKeys,
  type EmailSettings,
  type ProviderView,
  type SmsSettings,
} from './api'

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

/** Endereço de webhook para copiar (só funciona com a API em endereço público). */
function WebhookUrl({ url, reachable }: { url?: string; reachable: boolean }) {
  if (!url) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Endereço do webhook"
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigator.clipboard.writeText(url).then(() => toast.success('Endereço copiado.'))
          }
        >
          <Copy />
          Copiar
        </Button>
      </div>
      {!reachable && (
        <p className="text-xs text-warning">
          Este ambiente não tem endereço público (https): os provedores não conseguem chamá-lo.
          Funciona em produção.
        </p>
      )}
    </div>
  )
}

/** Placeholder do campo de segredo quando já há um salvo (ele nunca volta da API). */
const keepSecret = (hint: string) => `•••• ${hint} — deixe vazio para manter`

export function EmailProviderForm({ provider }: { provider: ProviderView<EmailSettings> | null }) {
  const queryClient = useQueryClient()
  const [fromEmail, setFromEmail] = useState(provider?.settings.fromEmail ?? '')
  const [fromName, setFromName] = useState(provider?.settings.fromName ?? '')
  const [replyTo, setReplyTo] = useState(provider?.settings.replyTo ?? '')
  const [eventWebhookKey, setEventWebhookKey] = useState(provider?.settings.eventWebhookKey ?? '')
  const [apiKey, setApiKey] = useState('')

  const save = useMutation({
    mutationFn: () =>
      messagingApi.saveEmail({
        fromEmail,
        fromName,
        replyTo: replyTo.trim() || null,
        eventWebhookKey: eventWebhookKey.trim() || null,
        apiKey: apiKey.trim() || undefined,
      }),
    onSuccess: () => {
      setApiKey('')
      toast.success('E-mail configurado. Envie um teste para confirmar.')
      void queryClient.invalidateQueries({ queryKey: messagingKeys.providers })
    },
  })

  return (
    <form
      aria-label="Configuração de e-mail"
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="sm:col-span-2">
        <FormError error={save.error} />
      </div>
      <div className="sm:col-span-2">
        <Field
          id="sendgrid-key"
          label="Chave de API do SendGrid"
          hint="SendGrid → Settings → API Keys → Create API Key, com permissão “Mail Send”. Fica guardada cifrada."
        >
          <Input
            id="sendgrid-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={provider ? keepSecret(provider.secretHint) : 'SG.xxxxxxxx'}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </Field>
      </div>
      <Field
        id="sendgrid-from"
        label="E-mail do remetente"
        hint="Precisa estar verificado no SendGrid (Sender Identity ou domínio autenticado)."
      >
        <Input
          id="sendgrid-from"
          type="email"
          value={fromEmail}
          placeholder="contato@suaempresa.com.br"
          onChange={(event) => setFromEmail(event.target.value)}
        />
      </Field>
      <Field id="sendgrid-name" label="Nome do remetente">
        <Input
          id="sendgrid-name"
          maxLength={100}
          value={fromName}
          placeholder="Sua Empresa"
          onChange={(event) => setFromName(event.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field id="sendgrid-reply" label="Responder para (opcional)">
          <Input
            id="sendgrid-reply"
            type="email"
            value={replyTo}
            placeholder="atendimento@suaempresa.com.br"
            onChange={(event) => setReplyTo(event.target.value)}
          />
        </Field>
      </div>
      <fieldset className="sm:col-span-2 flex flex-col gap-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Avisos de entrega (opcional)</legend>
        <p className="text-muted-foreground text-xs">
          Para ver “entregue”, “devolvido” e descadastros feitos no próprio SendGrid: em SendGrid →
          Settings → Mail Settings → Event Webhook, cole o endereço abaixo, ative “Signed Event
          Webhook” e copie a chave de verificação para cá.
        </p>
        {provider && (
          <WebhookUrl url={provider.webhooks.events} reachable={provider.webhooks.reachable} />
        )}
        <Field id="sendgrid-webhook-key" label="Chave de verificação (Verification Key)">
          <Input
            id="sendgrid-webhook-key"
            autoComplete="off"
            value={eventWebhookKey}
            placeholder="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…"
            onChange={(event) => setEventWebhookKey(event.target.value)}
          />
        </Field>
      </fieldset>
      <div className="sm:col-span-2 flex justify-end">
        <Button
          type="submit"
          disabled={
            !fromEmail.trim() || !fromName.trim() || (!provider && !apiKey.trim()) || save.isPending
          }
        >
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

export function SmsProviderForm({ provider }: { provider: ProviderView<SmsSettings> | null }) {
  const queryClient = useQueryClient()
  const [accountSid, setAccountSid] = useState(provider?.settings.accountSid ?? '')
  const [authToken, setAuthToken] = useState('')
  const [senderKind, setSenderKind] = useState<'number' | 'service'>(
    provider?.settings.messagingServiceSid ? 'service' : 'number',
  )
  const [from, setFrom] = useState(provider?.settings.from ?? '')
  const [serviceSid, setServiceSid] = useState(provider?.settings.messagingServiceSid ?? '')

  const save = useMutation({
    mutationFn: () =>
      messagingApi.saveSms({
        accountSid,
        authToken: authToken.trim() || undefined,
        from: senderKind === 'number' ? from : null,
        messagingServiceSid: senderKind === 'service' ? serviceSid : null,
      }),
    onSuccess: () => {
      setAuthToken('')
      toast.success('SMS configurado. Envie um teste para confirmar.')
      void queryClient.invalidateQueries({ queryKey: messagingKeys.providers })
    },
  })

  const sender = senderKind === 'number' ? from : serviceSid

  return (
    <form
      aria-label="Configuração de SMS"
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="sm:col-span-2">
        <FormError error={save.error} />
      </div>
      <Field
        id="twilio-sid"
        label="Account SID"
        hint="No painel da Twilio (Console), começa com AC."
      >
        <Input
          id="twilio-sid"
          autoComplete="off"
          value={accountSid}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          onChange={(event) => setAccountSid(event.target.value)}
        />
      </Field>
      <Field id="twilio-token" label="Auth Token" hint="Fica guardado cifrado.">
        <Input
          id="twilio-token"
          type="password"
          autoComplete="off"
          value={authToken}
          placeholder={provider ? keepSecret(provider.secretHint) : ''}
          onChange={(event) => setAuthToken(event.target.value)}
        />
      </Field>
      <fieldset className="sm:col-span-2 flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Enviar a partir de</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="twilio-sender"
              checked={senderKind === 'number'}
              onChange={() => setSenderKind('number')}
            />
            Um número da Twilio
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="twilio-sender"
              checked={senderKind === 'service'}
              onChange={() => setSenderKind('service')}
            />
            Um Messaging Service
          </label>
        </div>
        {senderKind === 'number' ? (
          <Input
            aria-label="Número remetente"
            value={from}
            placeholder="+55 11 99999-9999"
            onChange={(event) => setFrom(event.target.value)}
          />
        ) : (
          <Input
            aria-label="Messaging Service SID"
            value={serviceSid}
            placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            onChange={(event) => setServiceSid(event.target.value)}
          />
        )}
      </fieldset>
      {provider && (
        <div className="sm:col-span-2 flex flex-col gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">Descadastro por SMS (“SAIR”)</p>
          <p className="text-muted-foreground text-xs">
            Na Twilio, no número remetente (Phone Numbers → seu número → Messaging), em “A message
            comes in”, cole o endereço abaixo (método POST). Os avisos de entrega dos SMS são
            configurados sozinhos.
          </p>
          <WebhookUrl url={provider.webhooks.inbound} reachable={provider.webhooks.reachable} />
        </div>
      )}
      <div className="sm:col-span-2 flex justify-end">
        <Button
          type="submit"
          disabled={
            !accountSid.trim() ||
            !sender.trim() ||
            (!provider && !authToken.trim()) ||
            save.isPending
          }
        >
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
