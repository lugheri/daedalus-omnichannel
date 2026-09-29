import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { messageForCode } from '@/lib/api/api-error'
import { contactsApi, contactsQueryKey, type ImportReport } from './api'

/**
 * Importação de planilha CSV. O relatório diz o que entrou, o que já existia
 * e o que deu erro em cada linha (a linha 1 é o cabeçalho).
 */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')

  const run = useMutation({
    mutationFn: () => contactsApi.importCsv(file!, label),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: contactsQueryKey }),
  })

  const close = (next: boolean) => {
    if (!next) {
      setFile(null)
      setLabel('')
      run.reset()
    }
    onOpenChange(next)
  }

  const report = run.data
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Planilha em CSV (no Excel: “Salvar como” → “CSV”), com cabeçalho e colunas de nome,
            telefone e/ou e-mail. Até 2.000 linhas. Contatos que já existem não são duplicados.
          </DialogDescription>
        </DialogHeader>

        {report ? (
          <ImportResult report={report} />
        ) : (
          <div className="flex flex-col gap-4">
            <FormError error={run.error} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-file">Arquivo CSV</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-label">De onde vieram estes contatos? (opcional)</Label>
              <Input
                id="import-label"
                placeholder="Ex.: Feira 2026, base antiga"
                maxLength={200}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {report ? (
            <Button onClick={() => close(false)}>Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button disabled={!file || run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? 'Importando…' : 'Importar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportResult({ report }: { report: ImportReport }) {
  return (
    <div className="flex flex-col gap-3 text-sm" role="status">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-5 text-emerald-600" />
        {report.created} de {report.total} contatos importados
      </p>
      {report.duplicates > 0 && (
        <p className="text-muted-foreground">
          {report.duplicates} já existiam (na conta ou repetidos no arquivo) e foram pulados.
        </p>
      )}
      {report.errors.length > 0 && (
        <div>
          <p className="mb-1 font-medium">{report.errors.length} linha(s) com erro:</p>
          <ul className="bg-muted max-h-48 overflow-y-auto rounded-md p-2 text-xs">
            {report.errors.map((error) => (
              <li key={error.line}>
                Linha {error.line}: {messageForCode(error.code)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
