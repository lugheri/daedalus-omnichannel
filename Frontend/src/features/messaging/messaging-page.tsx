import { PageHeader } from '@/components/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useMessagingProviders } from './api'
import { ProviderCard } from './provider-card'
import { EmailProviderForm, SmsProviderForm } from './provider-forms'

/**
 * Provedores de e-mail e SMS da conta. As credenciais são da própria
 * empresa (os envios usam os créditos dela).
 */
export function MessagingPage() {
  const providers = useMessagingProviders()

  return (
    <>
      <PageHeader
        title="E-mail e SMS"
        description="Conecte as contas da sua empresa para enviar e-mails e SMS aos contatos (individual e campanhas)."
      />
      {providers.isPending && <Skeleton className="h-96" />}
      {providers.data && (
        <div className="grid max-w-5xl gap-6 xl:grid-cols-2">
          <ProviderCard
            channel="email"
            title="E-mail"
            description="Pelo SendGrid (o serviço de e-mail da Twilio)."
            provider={providers.data.email}
            testPlaceholder="seu@email.com"
          >
            {/* key: ao salvar/remover, o formulário recomeça com o que está na API */}
            <EmailProviderForm
              key={providers.data.email?.updatedAt ?? 'new'}
              provider={providers.data.email}
            />
          </ProviderCard>
          <ProviderCard
            channel="sms"
            title="SMS"
            description="Pela Twilio. Outros provedores podem ser adicionados depois."
            provider={providers.data.sms}
            testPlaceholder="(11) 98765-4321"
          >
            <SmsProviderForm
              key={providers.data.sms?.updatedAt ?? 'new'}
              provider={providers.data.sms}
            />
          </ProviderCard>
        </div>
      )}
    </>
  )
}
