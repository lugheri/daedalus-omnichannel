import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Building2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { authApi, type Tenant } from '../api'
import { useSession } from '../session-context'

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
type Credentials = z.infer<typeof schema>

/**
 * Login em até duas etapas: com várias contas, a API pede para escolher uma
 * (as credenciais ficam só em memória, nesta tela, para o segundo envio).
 */
export function LoginPage() {
  const { start } = useSession()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [choice, setChoice] = useState<{ credentials: Credentials; tenants: Tenant[] } | null>(null)

  const form = useForm<Credentials>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const logIn = useMutation({
    mutationFn: async (input: Credentials & { tenantId?: string }) => {
      const result = await authApi.logIn(input)
      if ('tenantSelectionRequired' in result) {
        setChoice({ credentials: input, tenants: result.tenants })
        return
      }
      await start(result)
      navigate(from, { replace: true })
    },
  })

  if (choice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escolha a conta</CardTitle>
          <CardDescription>Você tem acesso a mais de uma empresa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <FormError error={logIn.error} />
          {choice.tenants.map((tenant) => (
            <Button
              key={tenant.id}
              variant="outline"
              className="h-auto justify-between py-3"
              disabled={logIn.isPending}
              onClick={() => logIn.mutate({ ...choice.credentials, tenantId: tenant.id })}
            >
              <span className="flex items-center gap-2">
                <Building2 />
                {tenant.name}
              </span>
              <ChevronRight />
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setChoice(null)}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse o painel de atendimento.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((values) => logIn.mutate(values))} noValidate>
          <FieldGroup>
            <FormError error={logIn.error} />
            <TextField
              form={form}
              name="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              autoFocus
            />
            <TextField
              form={form}
              name="password"
              label="Senha"
              type="password"
              autoComplete="current-password"
            />
            <Button type="submit" disabled={logIn.isPending}>
              {logIn.isPending ? 'Entrando…' : 'Entrar'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Ainda não tem conta?{' '}
              <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
                Criar conta
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
