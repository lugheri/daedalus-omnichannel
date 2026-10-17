import { ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FORM_KIND_LABEL, useForms } from './api'
import { FormDialog } from './form-dialog'

export function FormsPage() {
  const forms = useForms()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Formulários"
        description="Formulários de contato e de solicitação de serviço para colar no site. Cada envio vira contato e negócio no funil."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Novo formulário
          </Button>
        }
      />

      {forms.isPending && <Skeleton className="h-24" />}
      {forms.data?.length === 0 && (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          Nenhum formulário ainda. Crie um e cole o HTML no site: os contatos caem aqui sozinhos.
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {forms.data?.map((form) => (
          <li key={form.id}>
            <Link
              to={`/forms/${form.id}`}
              className="bg-card hover:bg-accent flex h-full flex-col gap-2 rounded-lg border p-4"
            >
              <span className="flex items-center gap-2 font-medium">
                <ClipboardList className="text-muted-foreground size-4" />
                <span className="min-w-0 flex-1 truncate">{form.name}</span>
                {!form.active && <Badge variant="outline">Pausado</Badge>}
              </span>
              <span className="text-muted-foreground text-sm">{FORM_KIND_LABEL[form.kind]}</span>
              <span className="text-muted-foreground mt-auto text-xs">
                {form.submissions === 1 ? '1 envio' : `${form.submissions ?? 0} envios`}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {creating && <FormDialog open onOpenChange={setCreating} />}
    </>
  )
}
