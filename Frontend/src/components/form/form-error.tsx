import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { errorMessage } from '@/lib/api/api-error'

/** Erro vindo da API, já traduzido para o usuário. Não renderiza nada sem erro. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  )
}
