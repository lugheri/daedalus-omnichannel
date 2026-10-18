import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FormError } from '@/components/form/form-error'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
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
import { siteKeys, templatesApi, useSiteTemplates, type TemplateKind } from './api'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

/** Modelos de site (só na conta da plataforma; ADR 0010). */
export function TemplatesPage() {
  const templates = useSiteTemplates()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Modelos de site"
        description="HTML com marcadores que recebe o conteúdo de cada conta. Só os disponíveis aparecem para as contas escolherem."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Novo modelo
          </Button>
        }
      />
      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Nicho</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden sm:table-cell">Sites</TableHead>
              <TableHead className="hidden sm:table-cell">Alterado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.isPending && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {templates.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  Nenhum modelo ainda. O primeiro já nasce com um modelo inicial completo.
                </TableCell>
              </TableRow>
            )}
            {templates.data?.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <Link
                    to={`/site-templates/${template.id}`}
                    className="font-medium hover:underline"
                  >
                    {template.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {template.kind === 'landing' ? 'Landing page' : 'Site'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {template.niche ?? '—'}
                </TableCell>
                <TableCell>
                  {template.available ? (
                    <Badge variant="success">Disponível</Badge>
                  ) : (
                    <Badge variant="secondary">Rascunho</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {template.sites ?? 0}
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {dateFormat.format(new Date(template.updatedAt))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {creating && <NewTemplateDialog onOpenChange={setCreating} />}
    </>
  )
}

function NewTemplateDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [kind, setKind] = useState<TemplateKind>('site')

  const create = useMutation({
    mutationFn: () => templatesApi.create({ name, niche: niche.trim() || null, kind }),
    onSuccess: (template) => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.templates })
      void navigate(`/site-templates/${template.id}`)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) create.mutate()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo modelo</DialogTitle>
          <DialogDescription>
            Nasce como rascunho, com o modelo inicial do tipo (todas as seções) para você adaptar.
          </DialogDescription>
        </DialogHeader>
        <form id="template-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={create.error} />
            <Field>
              <FieldLabel htmlFor="template-name">Nome</FieldLabel>
              <Input
                id="template-name"
                autoFocus
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="template-kind">Tipo</FieldLabel>
              <Select value={kind} onValueChange={(value) => setKind(value as TemplateKind)}>
                <SelectTrigger id="template-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">Site (a página da empresa)</SelectItem>
                  <SelectItem value="landing">Landing page (página de campanha)</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Não muda depois: os marcadores de cada tipo são outros.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="template-niche">Nicho</FieldLabel>
              <Input
                id="template-niche"
                maxLength={60}
                placeholder="Ex.: Barbearia, Oficina, Clínica"
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="template-form" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
