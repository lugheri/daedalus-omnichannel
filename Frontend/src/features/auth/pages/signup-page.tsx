import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { authApi } from '../api'
import { useSession } from '../session-context'

/** Espelha as regras do backend para dar feedback imediato; a API valida de novo. */
const schema = z.object({
  accountName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(100),
  name: z.string().trim().min(1, 'Informe seu nome').max(120),
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres').max(128),
})
type SignUpForm = z.infer<typeof schema>

export function SignUpPage() {
  const { start } = useSession()
  const navigate = useNavigate()
  const form = useForm<SignUpForm>({
    resolver: zodResolver(schema),
    defaultValues: { accountName: '', name: '', email: '', password: '' },
  })

  const signUp = useMutation({
    mutationFn: async (values: SignUpForm) => {
      await start(await authApi.signUp(values))
      navigate('/', { replace: true })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Cadastre sua empresa. Você será o Owner da conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((values) => signUp.mutate(values))} noValidate>
          <FieldGroup>
            <FormError error={signUp.error} />
            <TextField form={form} name="accountName" label="Nome da empresa" autoFocus />
            <TextField form={form} name="name" label="Seu nome" autoComplete="name" />
            <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" />
            <TextField
              form={form}
              name="password"
              label="Senha"
              type="password"
              autoComplete="new-password"
              description="Mínimo de 8 caracteres."
            />
            <Button type="submit" disabled={signUp.isPending}>
              {signUp.isPending ? 'Criando…' : 'Criar conta'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Já tem conta?{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Entrar
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
