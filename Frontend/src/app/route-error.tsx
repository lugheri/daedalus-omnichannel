import { useEffect, useState } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Marca da última recarga automática (sessionStorage: vale só para esta aba).
 * Se a página recarregada falhar de novo dentro da janela, não recarrega outra
 * vez — mostra a tela, em vez de entrar num laço de recargas.
 */
const RELOAD_MARK = 'omni.chunkReloadAt'
const RELOAD_WINDOW_MS = 60_000

/**
 * Falha ao baixar um pedaço do código carregado sob demanda. Acontece com a aba
 * aberta durante um deploy: o arquivo antigo (com hash no nome) não existe mais
 * no servidor. Cada navegador escreve a mensagem de um jeito.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /dynamically imported module|importing a module script failed|unable to preload css|ChunkLoadError|Loading chunk .* failed/i.test(
    message,
  )
}

/**
 * Pode recarregar sozinho? Só se não houve recarga automática recente e se o
 * sessionStorage funciona (lê e grava) — sem ele não há como saber se já
 * recarregou, e o risco é um laço. Idempotente: pode rodar duas vezes no
 * StrictMode sem mudar a resposta.
 */
function canAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARK) ?? 0)
    sessionStorage.setItem(`${RELOAD_MARK}.probe`, '1')
    return Date.now() - last >= RELOAD_WINDOW_MS
  } catch {
    return false
  }
}

function autoReload() {
  try {
    sessionStorage.setItem(RELOAD_MARK, String(Date.now()))
  } catch {
    // Sem a marca gravada, recarregar arriscaria o laço. Não acontece na prática
    // (canAutoReload acabou de gravar); se acontecer, o recarregar do navegador resolve.
    return
  }
  window.location.reload()
}

/**
 * Tela de erro das rotas (`errorElement`). `inShell`: renderizada dentro da
 * moldura logada (o menu continua utilizável); sem ele, ocupa a tela inteira.
 */
export function RouteError({ inShell = false }: { inShell?: boolean }) {
  const error = useRouteError()
  const chunk = isChunkLoadError(error)
  // Decide no primeiro render, para não piscar a tela de erro antes de recarregar.
  const [reloading] = useState(() => chunk && canAutoReload())

  useEffect(() => {
    if (reloading) autoReload()
  }, [reloading])

  const notFound = isRouteErrorResponse(error) && error.status === 404
  const title = reloading
    ? 'Atualizando o sistema…'
    : chunk
      ? 'O sistema foi atualizado'
      : notFound
        ? 'Página não encontrada'
        : 'Algo deu errado nesta tela'
  const text = reloading
    ? 'Saiu uma versão nova. A página vai recarregar sozinha.'
    : chunk
      ? 'Saiu uma versão nova enquanto esta aba estava aberta. Recarregue a página para continuar.'
      : notFound
        ? 'O endereço não existe ou foi removido.'
        : 'Não foi culpa sua. Tente recarregar a página; se continuar, fale com o suporte.'
  const detail = error instanceof Error ? error.message : undefined

  return (
    <div
      role="alert"
      className={cn(
        'bg-background text-foreground flex flex-col items-center justify-center gap-4 p-6 text-center',
        inShell ? 'min-h-[60svh]' : 'min-h-svh',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-full',
          chunk ? 'bg-muted text-muted-foreground' : 'bg-warning-soft text-warning',
        )}
      >
        {chunk ? (
          <RefreshCw className={cn('size-6', reloading && 'animate-spin')} />
        ) : (
          <TriangleAlert className="size-6" />
        )}
      </span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{text}</p>
      </div>
      {!reloading && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw />
            Recarregar a página
          </Button>
          <Button asChild variant="outline">
            {/* reloadDocument: sai do estado quebrado do roteador por completo. */}
            <Link to="/" reloadDocument>
              Voltar ao início
            </Link>
          </Button>
        </div>
      )}
      {!reloading && !chunk && !notFound && detail && (
        <details className="text-faint max-w-sm text-xs">
          <summary className="cursor-pointer">Detalhes para o suporte</summary>
          <p className="mt-1 break-words">{detail}</p>
        </details>
      )}
    </div>
  )
}
