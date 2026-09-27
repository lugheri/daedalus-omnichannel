import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { authApi, type InvitationPreview } from '../api'
import { useSession } from '../session-context'

/** Tela do link de convite: `/invite/:token`. */
export function AcceptInvitePage() {
  const { token = '' } = useParams()
  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => authApi.lookUpInvitation(token),
    retry: false,
  })

  if (preview.isPending) return <FullPageSpinner />
  if (preview.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Convite indisponível</CardTitle>
          <CardDescription>
            O convite é inválido, expirou ou já foi usado. Peça um novo link a quem convidou você.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  return <AcceptForm token={token} invitation={preview.data} />
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Informe seu nome').max(120),
  password: z.string().min(8, 'Mínimo de 8 caracteres').max(128),
})
const existingUserSchema = z.object({
  name: z.string().optional(),
  password: z.string().min(1, 'Informe sua senha'),
})
type AcceptForm = z.infer<typeof existingUserSchema>

function AcceptForm({ token, invitation }: { token: string; invitation: InvitationPreview }) {
  const { start } = useSession()
  const navigate = useNavigate()
  const isNewUser = invitation.requiresSignup

  const form = useForm<AcceptForm>({
    resolver: zodResolver(isNewUser ? signUpSchema : existingUserSchema),
    defaultValues: { name: '', password: '' },
  })

  const accept = useMutation({
    mutationFn: async (values: AcceptForm) => {
      await start(
        await authApi.acceptInvitation({
          token,
          password: values.password,
          name: isNewUser ? values.name : undefined,
        }),
      )
      navigate('/', { replace: true })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Você foi convidado</CardTitle>
        <CardDescription>
          Entre em <strong>{invitation.tenant.name}</strong> como{' '}
          <strong>{invitation.role.name}</strong>, com o e-mail {invitation.email}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((values) => accept.mutate(values))} noValidate>
          <FieldGroup>
            <FormError error={accept.error} />
            {isNewUser && (
              <TextField form={form} name="name" label="Seu nome" autoComplete="name" autoFocus />
            )}
            <TextField
              form={form}
              name="password"
              label={isNewUser ? 'Crie uma senha' : 'Sua senha'}
              type="password"
              autoComplete={isNewUser ? 'new-password' : 'current-password'}
              description={
                isNewUser ? 'Mínimo de 8 caracteres.' : 'A senha que você já usa na plataforma.'
              }
              autoFocus={!isNewUser}
            />
            <Button type="submit" disabled={accept.isPending}>
              {accept.isPending ? 'Entrando…' : 'Aceitar convite'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
