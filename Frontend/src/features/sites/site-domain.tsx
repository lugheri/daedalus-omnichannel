import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api/api-error'
import { siteKeys, sitesApi, type Site, type SiteState } from './api'

const STATUS = {
  pending: { label: 'Aguardando publicação', variant: 'secondary' },
  checking: { label: 'Verificando…', variant: 'warning' },
  connected: { label: 'Conectado', variant: 'success' },
  unreachable: { label: 'Ainda não chega no site', variant: 'warning' },
} as const

/** Os registros de DNS para o domínio apontar para o túnel (ADR 0011). */
function DnsRecords({ domain, target }: { domain: string; target: string }) {
  const [first, ...rest] = domain.split('.')
  const isWww = first === 'www' && rest.length >= 2
  const records = isWww
    ? [
        { name: 'www', note: '' },
        { name: '@', note: `(${rest.join('.')}, que redireciona para o www)` },
      ]
    : [{ name: first, note: '' }]
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="mb-2 font-medium">No DNS do domínio, na Cloudflare:</p>
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pr-3 font-medium">Tipo</th>
            <th className="pr-3 font-medium">Nome</th>
            <th className="font-medium">Destino</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {records.map((record) => (
            <tr key={record.name}>
              <td className="pr-3">CNAME</td>
              <td className="pr-3">
                {record.name} <span className="text-muted-foreground font-sans">{record.note}</span>
              </td>
              <td className="break-all">{target}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-2 text-xs">
        Com o proxy ligado (nuvem laranja). O HTTPS é da Cloudflare: não precisa de certificado.
      </p>
    </div>
  )
}

/**
 * Domínio próprio do site (ADR 0011). Só quem gerencia a conta (acesso da
 * conta-mãe) ou a conta da plataforma define; o dono da conta vê o estado.
 * O valor é parte do rascunho do editor (vai no Salvar).
 */
export function DomainSection({
  site,
  value,
  onChange,
  canManage,
  target,
}: {
  site: Site
  value: string
  onChange: (value: string) => void
  canManage: boolean
  target: string | null
}) {
  const queryClient = useQueryClient()
  const changed = value.trim() !== (site.customDomain ?? '')
  const published = !!site.customDomain && site.publishedDomain === site.customDomain

  const check = useMutation({
    mutationFn: sitesApi.checkDomain,
    onSuccess: (next) =>
      queryClient.setQueryData<SiteState>(siteKeys.site, (current) =>
        current ? { ...current, site: next } : current,
      ),
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (!canManage && !site.customDomain) {
    return (
      <Field>
        <FieldLabel>Domínio próprio</FieldLabel>
        <FieldDescription>
          Para o site abrir em www.suaempresa.com.br, fale com quem gerencia a sua conta.
        </FieldDescription>
      </Field>
    )
  }

  const status = site.domainStatus ? STATUS[site.domainStatus] : null
  return (
    <Field>
      <FieldLabel htmlFor="site-domain">Domínio próprio</FieldLabel>
      {canManage ? (
        <Input
          id="site-domain"
          className="font-mono"
          maxLength={253}
          placeholder="www.suaempresa.com.br"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <p className="font-mono text-sm">{site.customDomain}</p>
      )}
      {site.customDomain && !changed && status && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {published && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={check.isPending || site.domainStatus === 'checking'}
              onClick={() => check.mutate()}
            >
              <RefreshCw />
              Verificar agora
            </Button>
          )}
        </div>
      )}
      <FieldDescription>
        {changed
          ? 'Salve e publique para o site ir para o domínio.'
          : site.domainStatus === 'unreachable'
            ? 'O DNS pode levar alguns minutos (às vezes horas) para valer. Confira os registros abaixo e verifique de novo.'
            : canManage
              ? 'Use o endereço com www. O domínio sem www redireciona para ele.'
              : 'Definido por quem gerencia a sua conta.'}
      </FieldDescription>
      {canManage && value.trim() && target && (
        <DnsRecords domain={value.trim().toLowerCase()} target={target} />
      )}
      {canManage && value.trim() && !target && (
        <FieldDescription>
          O túnel dos domínios próprios não está configurado neste servidor (SITES_DOMAIN_TARGET).
        </FieldDescription>
      )}
    </Field>
  )
}
