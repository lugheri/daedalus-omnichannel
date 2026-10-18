import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  MoreHorizontal,
  PowerOff,
  Rocket,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Skeleton } from '@/components/ui/skeleton'
import { useForms } from '@/features/forms/api'
import { PUBLISH_ERRORS, useAvailableTemplates } from '@/features/sites/api'
import { SitePreview } from '@/features/sites/site-preview'
import { usePreview } from '@/features/sites/use-preview'
import { errorMessage } from '@/lib/api/api-error'
import { cn } from '@/lib/utils'
import { AbTestPanel } from './ab-test-panel'
import {
  landingApi,
  landingKeys,
  MAX_VARIANTS,
  useLandingPage,
  type LandingContent,
  type LandingPage,
  type VariantChanges,
} from './api'
import { LandingContentFields } from './landing-content-fields'
import { NO_FORM } from './landing-format'
import { LandingStatus } from './landing-status'

interface VariantDraft {
  name: string
  templateId: string
  content: LandingContent
  weight: number
}

const draftsOf = (page: LandingPage): Record<string, VariantDraft> =>
  Object.fromEntries(
    page.variants.map((v) => [
      v.id,
      { name: v.name, templateId: v.templateId, content: v.content, weight: v.weight },
    ]),
  )

export function LandingPagePage() {
  const { id = '' } = useParams()
  const page = useLandingPage(id)
  if (page.isPending) return <Skeleton className="h-96" />
  if (!page.data) return <p className="text-muted-foreground text-sm">{errorMessage(page.error)}</p>
  // Mudou no servidor (salvou, variante nova, vencedora): o editor recomeça do que está gravado.
  const version = `${page.data.updatedAt}|${page.data.variants.map((v) => `${v.id}:${v.updatedAt}`).join(',')}`
  return <LandingEditor key={`${page.data.id}|${version}`} page={page.data} />
}

function LandingEditor({ page }: { page: LandingPage }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const templates = useAvailableTemplates('landing')
  const [params, setParams] = useSearchParams()
  const selected = page.variants.find((v) => v.code === params.get('v')) ?? page.variants[0]
  const [drafts, setDrafts] = useState(() => draftsOf(page))
  const saved = useMemo(() => draftsOf(page), [page])
  const dirtyIds = page.variants
    .map((v) => v.id)
    .filter((vid) => JSON.stringify(drafts[vid]) !== JSON.stringify(saved[vid]))
  const dirty = dirtyIds.length > 0
  const noTraffic = page.variants.every((v) => drafts[v.id].weight === 0)
  const draft = drafts[selected.id]
  const [settings, setSettings] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removingVariant, setRemovingVariant] = useState(false)

  const select = (code: string) => setParams(code === 'a' ? {} : { v: code }, { replace: true })
  const setDraft = (vid: string, change: (d: VariantDraft) => VariantDraft) =>
    setDrafts((current) => ({ ...current, [vid]: change(current[vid]) }))
  const patch = (change: (c: LandingContent) => void) =>
    setDraft(selected.id, (d) => {
      const content = structuredClone(d.content)
      change(content)
      return { ...d, content }
    })

  const fetchPreview = useCallback(
    (input: { variantId: string; templateId: string; content: LandingContent }) =>
      landingApi.preview(page.id, input),
    [page.id],
  )
  const preview = usePreview(
    { variantId: selected.id, templateId: draft.templateId, content: draft.content },
    fetchPreview,
  )

  const apply = (next: LandingPage) => {
    queryClient.setQueryData(landingKeys.page(page.id), next)
    void queryClient.invalidateQueries({ queryKey: landingKeys.list })
  }

  /** Grava as variantes alteradas (só o que mudou em cada uma). */
  const saveDrafts = async (): Promise<LandingPage | null> => {
    let last: LandingPage | null = null
    for (const vid of dirtyIds) {
      const d = drafts[vid]
      const s = saved[vid]
      const changes: VariantChanges = {}
      if (d.name !== s.name) changes.name = d.name
      if (d.templateId !== s.templateId) changes.templateId = d.templateId
      if (JSON.stringify(d.content) !== JSON.stringify(s.content)) changes.content = d.content
      if (d.weight !== s.weight) changes.weight = d.weight
      last = await landingApi.updateVariant(page.id, vid, changes)
    }
    return last
  }

  const save = useMutation({
    mutationFn: saveDrafts,
    onSuccess: (next) => {
      if (next) apply(next)
      toast.success(page.isLive ? 'Salvo. Publique para atualizar a página no ar.' : 'Salvo.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await saveDrafts()
      return landingApi.publish(page.id)
    },
    onSuccess: (next) => {
      apply(next)
      toast.success('Publicando… em instantes a página estará no ar.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const unpublish = useMutation({
    mutationFn: () => landingApi.unpublish(page.id),
    onSuccess: apply,
    onError: (error) => toast.error(errorMessage(error)),
  })
  const addVariant = useMutation({
    mutationFn: async () => {
      if (dirty) await saveDrafts()
      return landingApi.addVariant(page.id, selected.id)
    },
    onSuccess: (next) => {
      const created = next.variants.find((v) => v.id === next.createdVariantId)
      apply(next)
      if (created) select(created.code)
      toast.success('Variante criada: é uma cópia. Mude o que quer testar.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const removeVariant = useMutation({
    mutationFn: () => landingApi.removeVariant(page.id, selected.id),
    onSuccess: (next) => {
      select('a')
      apply(next)
      toast.success('Variante excluída.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: () => landingApi.remove(page.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: landingKeys.all })
      toast.success('Landing page excluída.')
      void navigate('/landing-pages')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const busy =
    save.isPending ||
    publish.isPending ||
    addVariant.isPending ||
    removeVariant.isPending ||
    !!page.pendingAction

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/landing-pages">
          <ArrowLeft />
          Landing pages
        </Link>
      </Button>
      <PageHeader
        title={page.name}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!dirty || busy || noTraffic}
              onClick={() => save.mutate()}
            >
              <Save />
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button disabled={busy || noTraffic} onClick={() => publish.mutate()}>
              <Rocket />
              {page.isLive ? 'Publicar alterações' : 'Publicar'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações da landing page">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSettings(true)}>
                  <Settings2 />
                  Nome, endereço e formulário
                </DropdownMenuItem>
                {page.isLive && (
                  <DropdownMenuItem disabled={busy} onSelect={() => unpublish.mutate()}>
                    <PowerOff />
                    Tirar do ar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={page.isLive || !!page.pendingAction}
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <LandingStatus page={page} />
        {page.url && (
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex items-center gap-1 truncate text-sm',
              page.isLive
                ? 'text-primary hover:underline'
                : 'text-muted-foreground pointer-events-none',
            )}
          >
            {page.url.replace(/^https?:\/\//, '')}
            {page.isLive && <ExternalLink className="size-3.5" />}
          </a>
        )}
        {!page.formId && (
          <span className="text-muted-foreground text-xs">
            Sem formulário: não conta conversões.
          </span>
        )}
        {dirty && <span className="text-muted-foreground text-xs">Alterações não salvas</span>}
      </div>

      {page.lastError && (
        <Alert variant="destructive">
          <AlertTitle>A última publicação falhou</AlertTitle>
          <AlertDescription>
            {PUBLISH_ERRORS[page.lastError] ?? 'Erro inesperado. Tente publicar de novo.'}
          </AlertDescription>
        </Alert>
      )}

      <AbTestPanel
        page={page}
        weights={Object.fromEntries(page.variants.map((v) => [v.id, drafts[v.id].weight]))}
        onWeightChange={(vid, weight) => setDraft(vid, (d) => ({ ...d, weight }))}
        busy={busy || dirty}
      />

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Variantes">
        {page.variants.map((v) => (
          <Button
            key={v.id}
            role="tab"
            aria-selected={v.id === selected.id}
            variant={v.id === selected.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => select(v.code)}
          >
            {v.code.toUpperCase()} · {drafts[v.id].name}
            {dirtyIds.includes(v.id) && <span aria-label="alterada"> •</span>}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page.variants.length >= MAX_VARIANTS || busy}
          onClick={() => addVariant.mutate()}
        >
          <Copy />
          Nova variante (cópia da {selected.code.toUpperCase()})
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-name">Nome da variante</FieldLabel>
              <Input
                id="variant-name"
                maxLength={80}
                value={draft.name}
                onChange={(event) =>
                  setDraft(selected.id, (d) => ({ ...d, name: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-template">Modelo</FieldLabel>
              <Select
                value={draft.templateId}
                onValueChange={(templateId) => setDraft(selected.id, (d) => ({ ...d, templateId }))}
              >
                <SelectTrigger id="variant-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!templates.data?.some((t) => t.id === selected.templateId) && (
                    <SelectItem value={selected.templateId}>
                      {selected.templateName ?? 'Modelo atual'}
                    </SelectItem>
                  )}
                  {templates.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <LandingContentFields
            key={selected.id}
            idPrefix={`variant-${selected.code}`}
            content={draft.content}
            patch={patch}
          />
          {page.variants.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => setRemovingVariant(true)}
            >
              <Trash2 />
              Excluir a variante {selected.code.toUpperCase()}
            </Button>
          )}
          <p className="text-muted-foreground text-xs">
            Nome, logo, cor, WhatsApp e endereço vêm do{' '}
            <Link to="/site" className="underline">
              site da empresa
            </Link>
            .
          </p>
        </div>

        <SitePreview
          html={preview.html}
          loading={preview.loading}
          title={`Prévia da variante ${selected.code.toUpperCase()}`}
          className="xl:sticky xl:top-0 xl:h-[calc(100svh-11rem)] xl:self-start"
        />
      </div>

      {settings && <SettingsDialog page={page} onOpenChange={setSettings} onSaved={apply} />}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {page.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A página, as variantes e os números somem. Os contatos e negócios que vieram dela
              continuam no CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removingVariant} onOpenChange={setRemovingVariant}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a variante {selected.code.toUpperCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo e os números dela somem. Para só tirá-la do teste, deixe o peso em 0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removeVariant.mutate()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SettingsDialog({
  page,
  onOpenChange,
  onSaved,
}: {
  page: LandingPage
  onOpenChange: (open: boolean) => void
  onSaved: (page: LandingPage) => void
}) {
  const forms = useForms()
  const [name, setName] = useState(page.name)
  const [path, setPath] = useState(page.path)
  const [formId, setFormId] = useState(page.formId ?? NO_FORM)
  const options = forms.data?.filter((f) => f.active || f.id === page.formId) ?? []

  const save = useMutation({
    mutationFn: () =>
      landingApi.update(page.id, {
        name,
        path,
        formId: formId === NO_FORM ? null : formId,
      }),
    onSuccess: (next) => {
      onSaved(next)
      toast.success(next.isLive ? 'Salvo. Publique para valer no ar.' : 'Salvo.')
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nome, endereço e formulário</DialogTitle>
          <DialogDescription>Valem para todas as variantes.</DialogDescription>
        </DialogHeader>
        <form id="landing-settings" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={save.error} />
            <Field>
              <FieldLabel htmlFor="settings-name">Nome da campanha</FieldLabel>
              <Input
                id="settings-name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-path">Endereço</FieldLabel>
              <Input
                id="settings-path"
                className="font-mono"
                maxLength={60}
                value={path}
                onChange={(event) => setPath(event.target.value.toLowerCase())}
              />
              <FieldDescription>
                No ar, o endereço antigo sai do ar na próxima publicação.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-form">Formulário (a conversão)</FieldLabel>
              <Select value={formId} onValueChange={setFormId}>
                <SelectTrigger id="settings-form" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_FORM}>Sem formulário (só WhatsApp)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="landing-settings" disabled={!name.trim() || save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
