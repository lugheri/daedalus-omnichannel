import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api/api-error'
import { siteKeys, templatesApi, useSiteTemplate, type SiteTemplate } from './api'
import { markerGroupsFor } from './markers'
import { SitePreview } from './site-preview'
import { usePreview } from './use-preview'

const PREVIEW_DELAY_MS = 800

/** Erro do modelo com o motivo do Mustache (ex.: marcador não fechado). */
function templateError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'SITE_TEMPLATE_INVALID_HTML') {
    return `Há um erro nos marcadores: ${error.message}`
  }
  return errorMessage(error)
}

export function TemplatePage() {
  const { id = '' } = useParams()
  const template = useSiteTemplate(id)
  if (template.isPending) return <Skeleton className="h-96" />
  if (!template.data) {
    return <p className="text-muted-foreground text-sm">{errorMessage(template.error)}</p>
  }
  return <TemplateEditor key={template.data.id} template={template.data} />
}

function TemplateEditor({ template }: { template: SiteTemplate }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(template.name)
  const [niche, setNiche] = useState(template.niche ?? '')
  const [description, setDescription] = useState(template.description ?? '')
  const [html, setHtml] = useState(template.html)
  const [available, setAvailable] = useState(template.available)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty =
    name !== template.name ||
    niche !== (template.niche ?? '') ||
    description !== (template.description ?? '') ||
    html !== template.html ||
    available !== template.available

  // Prévia com o site de exemplo (o erro dos marcadores aparece acima dela).
  const preview = usePreview({ html, kind: template.kind }, templatesApi.preview, PREVIEW_DELAY_MS)
  const previewError = preview.error ? templateError(preview.error) : null

  const save = useMutation({
    mutationFn: () =>
      templatesApi.update(template.id, {
        name,
        niche: niche.trim() || null,
        description: description.trim() || null,
        html,
        available,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(siteKeys.template(template.id), next)
      void queryClient.invalidateQueries({ queryKey: siteKeys.templates })
      void queryClient.invalidateQueries({ queryKey: ['site', 'templates', 'available'] })
      toast.success(
        next.available
          ? 'Modelo salvo. Os sites que o usam mudam na próxima publicação.'
          : 'Modelo salvo (rascunho: as contas ainda não veem).',
      )
    },
    onError: (error) => toast.error(templateError(error)),
  })

  const remove = useMutation({
    mutationFn: () => templatesApi.remove(template.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.templates })
      toast.success('Modelo excluído.')
      void navigate('/site-templates')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/site-templates">
          <ArrowLeft />
          Modelos de site
        </Link>
      </Button>
      <PageHeader
        title={template.name}
        description={`${template.kind === 'landing' ? 'Modelo de landing page' : 'Modelo de site'} · ${
          template.sites
            ? `usado ${template.sites} ${template.sites === 1 ? 'vez' : 'vezes'}.`
            : 'ninguém usa ainda.'
        }`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              Excluir
            </Button>
            <Button
              disabled={!dirty || save.isPending || !name.trim()}
              onClick={() => save.mutate()}
            >
              <Save />
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      />

      <FieldGroup className="grid gap-4 md:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="tpl-name">Nome</FieldLabel>
          <Input
            id="tpl-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="tpl-niche">Nicho</FieldLabel>
          <Input
            id="tpl-niche"
            maxLength={60}
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="tpl-description">Descrição</FieldLabel>
          <Input
            id="tpl-description"
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FieldGroup>
      <div className="flex items-start gap-2">
        <Checkbox
          id="tpl-available"
          checked={available}
          onCheckedChange={(checked) => setAvailable(checked === true)}
        />
        <div className="grid gap-0.5">
          <Label htmlFor="tpl-available">Disponível para as contas</Label>
          <p className="text-muted-foreground text-xs">
            Desmarcar tira o modelo da escolha; quem já usa continua usando.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="tpl-html">HTML do modelo</Label>
          <Textarea
            id="tpl-html"
            spellCheck={false}
            className="min-h-[560px] font-mono text-xs leading-relaxed"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
          />
          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Marcadores disponíveis</summary>
            <div className="mt-3 flex flex-col gap-4">
              {markerGroupsFor(template.kind).map((group) => (
                <section key={group.title}>
                  <h3 className="mb-1 text-xs font-semibold uppercase">{group.title}</h3>
                  <dl className="grid gap-1">
                    {group.items.map((item) => (
                      <div
                        key={item.marker}
                        className="grid gap-x-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                      >
                        <dt>
                          <code className="text-xs break-all">{item.marker}</code>
                        </dt>
                        <dd className="text-muted-foreground text-xs">{item.description}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </details>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {previewError && (
            <p role="alert" className="text-destructive text-sm">
              {previewError}
            </p>
          )}
          <SitePreview
            html={preview.html}
            loading={preview.loading}
            title={
              template.kind === 'landing'
                ? 'Prévia do modelo com a landing page de exemplo'
                : 'Prévia do modelo com o site de exemplo'
            }
            className="xl:sticky xl:top-0 xl:h-[calc(100svh-11rem)] xl:self-start"
          />
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o modelo {template.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só dá para excluir modelo que nenhum site usa. Para tirar da escolha sem excluir,
              desmarque “Disponível para as contas”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
