import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'
import {
  siteKeys,
  sitesApi,
  useAvailableTemplates,
  useSiteState,
  type SiteTemplateSummary,
} from './api'
import { SiteEditor } from './site-editor'

/**
 * O site da conta (ADR 0010): sem site, a escolha do modelo; com site, o
 * editor com prévia, salvar e publicar.
 */
export function SitePage() {
  const state = useSiteState()

  return (
    <>
      <PageHeader
        title="Meu site"
        description="O site da empresa: conteúdo, aparência, endereço e publicação."
      />
      {state.isPending && <Skeleton className="h-96" />}
      {state.isError && <p className="text-destructive text-sm">{errorMessage(state.error)}</p>}
      {state.data && !state.data.site && <TemplatePicker />}
      {state.data?.site && (
        <SiteEditor
          key={state.data.site.id}
          site={state.data.site}
          addressPattern={state.data.addressPattern}
          publishingEnabled={state.data.publishingEnabled}
          domainTarget={state.data.domainTarget}
          canManageDomain={state.data.canManageDomain}
        />
      )}
    </>
  )
}

/** Miniatura do modelo com o conteúdo inicial da conta (prévia reduzida, sem interação). */
function TemplateThumbnail({ template }: { template: SiteTemplateSummary }) {
  const preview = useQuery({
    queryKey: ['site', 'preview', 'template', template.id],
    queryFn: () => sitesApi.preview({ templateId: template.id }),
    staleTime: 60_000,
  })
  return (
    <div className="bg-muted relative h-56 overflow-hidden rounded-md border">
      {preview.data ? (
        <iframe
          title={`Prévia do modelo ${template.name}`}
          sandbox=""
          tabIndex={-1}
          srcDoc={preview.data.html}
          className="pointer-events-none absolute top-0 left-0 h-[700px] w-[1200px] origin-top-left scale-[0.32] bg-white"
        />
      ) : (
        <Skeleton className="size-full" />
      )}
    </div>
  )
}

function TemplatePicker() {
  const me = useMe()
  const queryClient = useQueryClient()
  const templates = useAvailableTemplates()

  const create = useMutation({
    mutationFn: sitesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.site })
      toast.success('Site criado. Preencha o conteúdo e publique.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (templates.isPending) return <Skeleton className="h-64" />
  if (!templates.data?.length) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed py-12 text-center text-sm">
        <LayoutTemplate className="size-6" />
        Nenhum modelo de site disponível ainda.
        {me.tenant.isRoot ? (
          <span>Crie e libere um modelo em Site › Modelos de site.</span>
        ) : (
          <span>Fale com quem gerencia a sua conta.</span>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby="pick-template" className="flex flex-col gap-3">
      <h2 id="pick-template" className="font-semibold">
        Escolha um modelo para começar
      </h2>
      <p className="text-muted-foreground text-sm">
        O modelo define a aparência; dá para trocar depois sem perder o conteúdo.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.data.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
              {(template.niche || template.description) && (
                <CardDescription>
                  {[template.niche, template.description].filter(Boolean).join(' · ')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <TemplateThumbnail template={template} />
              <Button disabled={create.isPending} onClick={() => create.mutate(template.id)}>
                Usar este modelo
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
