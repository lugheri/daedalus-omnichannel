import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/** Desenha o texto do QR (vindo da API) como imagem. */
export function QrCodeImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(value, { width: 264, margin: 1 }).then((url) => {
      if (active) setSrc(url)
    })
    return () => {
      active = false
    }
  }, [value])

  if (!src) return <Skeleton className="size-66" />
  return <img src={src} alt="QR code para conectar o WhatsApp" className="size-66 rounded-md" />
}
