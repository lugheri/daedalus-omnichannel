import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FormError } from '@/components/form/form-error'
import { PageHeader } from '@/components/page-header'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useForms } from '@/features/forms/api'
import { useAvailableTemplates } from '@/features/sites/api'
import { landingApi, landingKeys, suggestPath, useLandingPages } from './api'
import { formatRate, NO_FORM } from './landing-format'
import { LandingStatus } from './landing-status'

export function LandingPagesPage() {
  const pages = useLandingPages()
  const [creating, setCreating] = useState(false)
  const noSite = pages.data && !pages.data.hasSite

  return (
    <>
      <PageHeader
        title="Landing pages"
        description="Páginas de campanha no endereço do seu site, com teste A/B para descobrir a que converte mais."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!pages.data?.hasSite}>
            <Plus />
            Nova landing page
          </Button>
        }
      />
      {noSite && (
        <p className="bg-card text-muted-foreground mb-4 rounded-md border p-4 text-sm">
          A landing page mora no endereço do site da empresa.{' '}
          <Link to="/site" className="text-foreground underline">
            Crie o site primeiro
          </Link>{' '}
          (ele não precisa estar no ar).
        </p>
      )}

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Página</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Visitas</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Conversões</TableHead>
              <TableHead className="hidden text-right md:table-cell">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.isPending && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {pages.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  Nenhuma landing page ainda.
                </TableCell>
              </TableRow>
            )}
            {pages.data?.items.map((page) => (
              <TableRow key={page.id}>
                <TableCell>
                  <Link to={`/landing-pages/${page.id}`} className="font-medium hover:underline">
                    {page.name}
                  </Link>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    /{page.path}/
                    {page.isLive && page.url && (
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir ${page.name}`}
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <LandingStatus page={page} />
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {page.views}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {page.conversions}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatRate(page.views > 0 ? page.conversions / page.views : null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {creating && <NewLandingDialog onOpenChange={setCreating} />}
    </>
  )
}

function NewLandingDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const templates = useAvailableTemplates('landing')
  const forms = useForms()
  const activeForms = forms.data?.filter((f) => f.active) ?? []
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [pathTouched, setPathTouched] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [formId, setFormId] = useState('')
  const chosenTemplate = templateId || templates.data?.[0]?.id || ''
  const chosenForm = formId || activeForms[0]?.id || NO_FORM
  const finalPath = pathTouched ? path : suggestPath(name)

  const create = useMutation({
    mutationFn: () =>
      landingApi.create({
        name,
        path: finalPath,
        templateId: chosenTemplate,
        formId: chosenForm === NO_FORM ? null : chosenForm,
      }),
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: landingKeys.all })
      void navigate(`/landing-pages/${page.id}`)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() && finalPath && chosenTemplate) create.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova landing page</DialogTitle>
          <DialogDescription>
            Nasce com uma variante (A) e um texto inicial para você adaptar.
          </DialogDescription>
        </DialogHeader>
        <form id="landing-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={create.error} />
            <Field>
              <FieldLabel htmlFor="landing-name">Nome da campanha</FieldLabel>
              <Input
                id="landing-name"
                autoFocus
                maxLength={80}
                placeholder="Ex.: Dia dos Pais"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="landing-path">Endereço</FieldLabel>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground shrink-0">seu-site/</span>
                <Input
                  id="landing-path"
                  className="font-mono"
                  maxLength={60}
                  value={finalPath}
                  onChange={(event) => {
                    setPathTouched(true)
                    setPath(event.target.value.toLowerCase())
                  }}
                />
                <span className="text-muted-foreground shrink-0">/</span>
              </div>
              <FieldDescription>Letras minúsculas, números e hífen.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="landing-template">Modelo</FieldLabel>
              <Select value={chosenTemplate} onValueChange={setTemplateId}>
                <SelectTrigger id="landing-template" className="w-full">
                  <SelectValue placeholder="Nenhum modelo de landing disponível" />
                </SelectTrigger>
                <SelectContent>
                  {templates.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.niche && ` · ${t.niche}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.data?.length === 0 && (
                <FieldDescription>
                  Ainda não há modelo de landing page. Peça a quem administra a plataforma.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="landing-form-select">Formulário (a conversão)</FieldLabel>
              <Select value={chosenForm} onValueChange={setFormId}>
                <SelectTrigger id="landing-form-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeForms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_FORM}>Sem formulário (só WhatsApp)</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Cada envio conta como conversão da variante que a pessoa viu.{' '}
                <Link to="/forms" className="underline">
                  Criar formulário
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="landing-form"
            disabled={!name.trim() || !finalPath || !chosenTemplate || create.isPending}
          >
            {create.isPending ? 'Criando…' : 'Criar landing page'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
