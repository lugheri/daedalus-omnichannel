import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, MoreHorizontal, PowerOff, Rocket, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/api/api-error'
import {
  PUBLISH_ERRORS,
  siteKeys,
  sitesApi,
  useAvailableTemplates,
  type Site,
  type SiteContent,
  type SiteState,
} from './api'
import {
  AppearanceFields,
  BusinessFields,
  ExtrasFields,
  SectionsFields,
  SeoFields,
  type PatchContent,
} from './site-content-fields'
import { DomainSection } from './site-domain'
import { SitePreview } from './site-preview'
import { usePreview } from './use-preview'

interface Draft {
  content: SiteContent
  slug: string
  templateId: string
  /** "" = sem domínio próprio. */
  customDomain: string
}

const draftOf = (site: Site): Draft => ({
  content: site.content,
  slug: site.slug,
  templateId: site.templateId,
  customDomain: site.customDomain ?? '',
})

function SiteStatus({ site }: { site: Site }) {
  if (site.pendingAction === 'publish') return <Badge variant="warning">Publicando…</Badge>
  if (site.pendingAction === 'unpublish') return <Badge variant="warning">Tirando do ar…</Badge>
  if (!site.isLive) return <Badge variant="secondary">Fora do ar</Badge>
  if (site.hasUnpublishedChanges) {
    return <Badge variant="warning">No ar · alterações não publicadas</Badge>
  }
  return <Badge variant="success">No ar</Badge>
}

/**
 * Editor do site: o rascunho fica na tela até salvar; a prévia acompanha a
 * edição (sem gravar). Publicar salva antes, se houver alteração.
 */
export function SiteEditor({
  site,
  addressPattern,
  publishingEnabled,
  domainTarget,
  canManageDomain,
}: {
  site: Site
  addressPattern: string | null
  publishingEnabled: boolean
  domainTarget: string | null
  canManageDomain: boolean
}) {
  const queryClient = useQueryClient()
  const templates = useAvailableTemplates()
  const [draft, setDraft] = useState<Draft>(() => draftOf(site))
  const [saved, setSaved] = useState<Draft>(() => draftOf(site))
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  const patch: PatchContent = (change) =>
    setDraft((current) => {
      const content = structuredClone(current.content)
      change(content)
      return { ...current, content }
    })

  // Erro de validação na prévia não é mostrado: aparece ao salvar.
  const preview = usePreview(
    { content: draft.content, templateId: draft.templateId },
    sitesApi.preview,
  )

  const applySaved = (next: Site) => {
    queryClient.setQueryData<SiteState>(siteKeys.site, (current) =>
      current ? { ...current, site: next } : current,
    )
    setSaved(draftOf(next))
    setDraft(draftOf(next))
  }

  const changes = () => ({
    content: draft.content,
    ...(draft.slug !== saved.slug ? { slug: draft.slug } : {}),
    ...(draft.templateId !== saved.templateId ? { templateId: draft.templateId } : {}),
    ...(draft.customDomain.trim() !== saved.customDomain
      ? { customDomain: draft.customDomain.trim() || null }
      : {}),
  })

  const save = useMutation({
    mutationFn: () => sitesApi.update(changes()),
    onSuccess: (next) => {
      applySaved(next)
      toast.success(next.isLive ? 'Salvo. Publique para atualizar o site no ar.' : 'Salvo.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) applySaved(await sitesApi.update(changes()))
      return sitesApi.publish()
    },
    onSuccess: (next) => {
      queryClient.setQueryData<SiteState>(siteKeys.site, (current) =>
        current ? { ...current, site: next } : current,
      )
      toast.success('Publicando… em instantes o site estará no ar.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const unpublish = useMutation({
    mutationFn: sitesApi.unpublish,
    onSuccess: (next) =>
      queryClient.setQueryData<SiteState>(siteKeys.site, (current) =>
        current ? { ...current, site: next } : current,
      ),
    onError: (error) => toast.error(errorMessage(error)),
  })

  const busy = save.isPending || publish.isPending || !!site.pendingAction
  const [prefix, suffix] = (addressPattern ?? '{slug}').split('{slug}')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SiteStatus site={site} />
          {site.liveUrl && (
            <a
              href={site.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 truncate text-sm hover:underline"
            >
              {site.liveUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="size-3.5" />
            </a>
          )}
          {dirty && <span className="text-muted-foreground text-xs">Alterações não salvas</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={!dirty || busy} onClick={() => save.mutate()}>
            <Save />
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button disabled={busy || !publishingEnabled} onClick={() => publish.mutate()}>
            <Rocket />
            {site.isLive ? 'Publicar alterações' : 'Publicar'}
          </Button>
          {site.isLive && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações do site">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busy}
                  onSelect={() => unpublish.mutate()}
                >
                  <PowerOff />
                  Tirar do ar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {!publishingEnabled && (
        <Alert>
          <AlertTitle>Publicação desligada neste servidor</AlertTitle>
          <AlertDescription>
            Falta configurar o bucket dos sites (SITES_BUCKET e SITES_URL). Dá para editar e ver a
            prévia, mas não publicar nem enviar imagens.
          </AlertDescription>
        </Alert>
      )}
      {site.lastError && (
        <Alert variant="destructive">
          <AlertTitle>A última publicação falhou</AlertTitle>
          <AlertDescription>
            {PUBLISH_ERRORS[site.lastError] ?? 'Erro inesperado. Tente publicar de novo.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Tabs defaultValue="business" className="min-w-0">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="business">Empresa</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="sections">Seções</TabsTrigger>
            <TabsTrigger value="extras">Conteúdo</TabsTrigger>
            <TabsTrigger value="address">Endereço</TabsTrigger>
          </TabsList>
          <TabsContent value="business" className="pt-2">
            <BusinessFields content={draft.content} patch={patch} />
          </TabsContent>
          <TabsContent value="appearance" className="pt-2">
            <AppearanceFields content={draft.content} patch={patch} />
          </TabsContent>
          <TabsContent value="sections" className="pt-2">
            <SectionsFields content={draft.content} patch={patch} />
          </TabsContent>
          <TabsContent value="extras" className="pt-2">
            <ExtrasFields content={draft.content} patch={patch} />
          </TabsContent>
          <TabsContent value="address" className="pt-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="site-slug">Endereço do site</FieldLabel>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground shrink-0">{prefix}</span>
                  <Input
                    id="site-slug"
                    className="min-w-0 font-mono"
                    maxLength={63}
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        slug: event.target.value.toLowerCase(),
                      }))
                    }
                  />
                  <span className="text-muted-foreground shrink-0">{suffix}</span>
                </div>
                <FieldDescription>
                  Letras minúsculas, números e hífen. Ao mudar com o site no ar, o endereço antigo
                  sai do ar na próxima publicação. Continua valendo mesmo com domínio próprio.
                </FieldDescription>
              </Field>
              <DomainSection
                site={site}
                value={draft.customDomain}
                onChange={(customDomain) => setDraft((current) => ({ ...current, customDomain }))}
                canManage={canManageDomain}
                target={domainTarget}
              />
              <Field>
                <FieldLabel htmlFor="site-template">Modelo</FieldLabel>
                <Select
                  value={draft.templateId}
                  onValueChange={(templateId) =>
                    setDraft((current) => ({ ...current, templateId }))
                  }
                >
                  <SelectTrigger id="site-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!templates.data?.some((t) => t.id === site.templateId) && (
                      <SelectItem value={site.templateId}>
                        {site.templateName ?? 'Modelo atual'}
                      </SelectItem>
                    )}
                    {templates.data?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.niche && ` · ${template.niche}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Trocar o modelo muda só a aparência: o conteúdo é o mesmo.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <div className="mt-6">
              <SeoFields content={draft.content} patch={patch} />
            </div>
          </TabsContent>
        </Tabs>

        <SitePreview
          html={preview.html}
          loading={preview.loading}
          className="xl:sticky xl:top-0 xl:h-[calc(100svh-11rem)] xl:self-start"
        />
      </div>
    </div>
  )
}
