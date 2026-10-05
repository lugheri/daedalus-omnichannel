import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/features/auth/session'
import { ApiError } from '@/lib/api/api-error'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Erro 4xx não melhora tentando de novo; só erros de rede/servidor.
            retry: (count, error) =>
              count < 2 &&
              !(error instanceof ApiError && error.status >= 400 && error.status < 500),
          },
        },
      }),
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
