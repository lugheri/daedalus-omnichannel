import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useSourceDetails, type LeadSource } from '@/features/contacts/api'
import { LEAD_SOURCE_LABELS, LEAD_SOURCES } from '@/features/contacts/lead-source'
import type { MessagingChannel } from '@/features/messaging/api'
import { smsSegments } from '@/features/messaging/sms'
import {
  campaignKeys,
  campaignsApi,
  useAudiencePreview,
  useCampaign,
  type Campaign,
  type CampaignAudience,
} from './api'

/** Marcador do Select para "todas" (o Radix não aceita valor vazio). */
const ALL = 'all'
const SMS_FOOTER = 'Para não receber mais, responda SAIR.'

/** Criar (rota /campaigns/new) ou editar (/campaigns/:id/edit) uma campanha. */
export function CampaignEditorPage() {
  const { id } = useParams()
  const campaign = useCampaign(id)
  if (id && !campaign.data) return <Skeleton className="h-96" />
  return <CampaignEditor key={id ?? 'new'} campaign={campaign.data} />
}

function CampaignEditor({ campaign }: { campaign?: Campaign }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const sourceDetails = useSourceDetails()
  const [name, setName] = useState(campaign?.name ?? '')
  const [channel, setChannel] = useState<MessagingChannel>(campaign?.channel ?? 'email')
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')
  const [source, setSource] = useState<LeadSource | typeof ALL>(campaign?.audience.source ?? ALL)
  const [sourceDetail, setSourceDetail] = useState(campaign?.audience.sourceDetail ?? ALL)
  const [search, setSearch] = useState(campaign?.audience.search ?? '')

  const audience: CampaignAudience = {
    ...(source !== ALL && { source }),
    ...(sourceDetail !== ALL && { sourceDetail }),
    ...(search.trim() && { search: search.trim() }),
  }
  // A prévia do público acompanha os filtros sem uma requisição por tecla.
  const preview = useAudiencePreview(channel, useDeferredValue(audience))
  const isEmail = channel === 'email'
  const segments = smsSegments(`${body}\n\n${SMS_FOOTER}`)

  const save = useMutation({
    mutationFn: () => {
      const input = { name, body, audience, ...(isEmail && { subject }) }
      return campaign
        ? campaignsApi.update(campaign.id, input)
        : campaignsApi.create({ ...input, channel })
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      toast.success('Campanha salva.')
      void navigate(`/campaigns/${saved.id}`)
    },
  })

  const invalid = !name.trim() || !body.trim() || (isEmail && !subject.trim())

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to={campaign ? `/campaigns/${campaign.id}` : '/campaigns'}>
          <ArrowLeft />
          {campaign ? 'Voltar à campanha' : 'Campanhas'}
        </Link>
      </Button>
      <PageHeader
        title={campaign ? 'Editar campanha' : 'Nova campanha'}
        description="Escolha o público, escreva a mensagem e, depois de salvar, envie ou agende."
      />

      <form
        className="flex flex-col gap-6"
        aria-label="Campanha"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <FormError error={save.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="campaign-name">Nome (interno)</Label>
            <Input
              id="campaign-name"
              maxLength={100}
              value={name}
              placeholder="Ex.: Black Friday — leads da feira"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="campaign-channel">Canal</Label>
            <Select
              value={channel}
              disabled={Boolean(campaign)}
              onValueChange={(v) => setChannel(v as MessagingChannel)}
            >
              <SelectTrigger id="campaign-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">Público</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="audience-source">Origem</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource | typeof ALL)}>
                <SelectTrigger id="audience-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="audience-detail">Campanha / lote</Label>
              <Select value={sourceDetail} onValueChange={setSourceDetail}>
                <SelectTrigger id="audience-detail" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {sourceDetails.data
                    ?.filter((d) => source === ALL || d.source === source)
                    .map((d) => (
                      <SelectItem key={`${d.source}|${d.detail}`} value={d.detail}>
                        {d.detail} ({d.count})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="audience-search">Busca</Label>
              <Input
                id="audience-search"
                value={search}
                placeholder="Nome, e-mail ou telefone"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <Users className="text-muted-foreground size-4" />
            {preview.data ? (
              <span>
                <strong>{preview.data.total}</strong> contatos no filtro;{' '}
                <strong>{preview.data.reachable}</strong> com {isEmail ? 'e-mail' : 'telefone'}.
                Quem se descadastrou é pulado no envio.
              </span>
            ) : (
              <span className="text-muted-foreground">Calculando o público…</span>
            )}
          </p>
        </fieldset>

        {isEmail && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="campaign-subject">Assunto</Label>
            <Input
              id="campaign-subject"
              maxLength={200}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-body">Mensagem</Label>
          <Textarea
            id="campaign-body"
            rows={isEmail ? 10 : 5}
            maxLength={isEmail ? 20_000 : 1_550}
            value={body}
            placeholder="Olá {{nome}}, …"
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {'{{nome}}'} vira o primeiro nome do contato; {'{{nome_completo}}'}, o nome inteiro.{' '}
            {isEmail
              ? 'O rodapé com o link de descadastro é adicionado automaticamente.'
              : `No fim entra “${SMS_FOOTER}” — ${segments} SMS por contato (cobrados pelo provedor). Os SMS saem no ritmo de 1 por segundo.`}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={invalid || save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
