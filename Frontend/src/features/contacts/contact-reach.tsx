import { Mail, MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mailtoUrl, telUrl, whatsappUrl } from '@/lib/contact-links'
import { formatPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'

/**
 * Atender o contato por fora do sistema: WhatsApp (`wa.me`), Ligar (`tel:`) e
 * E-mail (`mailto:`), cada um só quando o dado existe. Mostra também o número e
 * o e-mail como texto selecionável, para copiar.
 *
 * `compact`: só os ícones (card do funil), com o rótulo acessível no link.
 */
export function ContactReach({
  phone,
  email,
  name,
  compact = false,
  className,
}: {
  phone: string | null
  email: string | null
  /** Para o rótulo acessível ("WhatsApp de Maria"). */
  name?: string | null
  compact?: boolean
  className?: string
}) {
  const whatsapp = whatsappUrl(phone)
  const tel = telUrl(phone)
  const mailto = mailtoUrl(email)
  if (!phone && !email) return null

  const of = name ? ` de ${name}` : ''

  if (compact) {
    const links = [
      whatsapp && { href: whatsapp, label: `WhatsApp${of}`, icon: MessageCircle, external: true },
      tel && { href: tel, label: `Ligar para ${name ?? 'o contato'}`, icon: Phone },
      mailto && { href: mailto, label: `E-mail para ${name ?? 'o contato'}`, icon: Mail },
    ].filter((link) => !!link)
    if (links.length === 0) return null
    return (
      <div className={cn('flex items-center gap-0.5', className)}>
        {links.map(({ href, label, icon: Icon, external }) => (
          <Button
            key={href}
            asChild
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
          >
            <a
              href={href}
              aria-label={label}
              title={label}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <Icon />
            </a>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2 text-sm', className)}>
      {phone && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground flex items-center gap-1">
            <Phone className="size-3.5" />
            <span className="text-foreground select-all">{formatPhone(phone)}</span>
          </span>
          {whatsapp && (
            <Button asChild variant="outline" size="sm">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp${of}`}
                title="Abrir a conversa no WhatsApp"
              >
                <MessageCircle />
                WhatsApp
              </a>
            </Button>
          )}
          {tel && (
            <Button asChild variant="outline" size="sm">
              <a
                href={tel}
                aria-label={`Ligar para ${name ?? 'o contato'}`}
                title="Ligar pelo celular"
              >
                <Phone />
                Ligar
              </a>
            </Button>
          )}
        </div>
      )}
      {email && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground flex min-w-0 items-center gap-1">
            <Mail className="size-3.5 shrink-0" />
            <span className="text-foreground break-all select-all">{email}</span>
          </span>
          {mailto && (
            <Button asChild variant="outline" size="sm">
              <a
                href={mailto}
                aria-label={`E-mail para ${name ?? 'o contato'}`}
                title="Escrever pelo seu programa de e-mail"
              >
                <Mail />
                E-mail
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
