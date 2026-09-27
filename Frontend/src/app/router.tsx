import { createBrowserRouter } from 'react-router'
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/pages/login-page'
import { AppLayout } from './layouts/app-layout'
import { AuthLayout } from './layouts/auth-layout'
import { NotFoundPage } from './not-found-page'

/**
 * Páginas carregadas sob demanda: cada uma vira um arquivo JS separado, baixado
 * só quando a rota é aberta (o login não carrega o código da gestão).
 */
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: '/login', element: <LoginPage /> },
          {
            path: '/signup',
            ...page(() => import('@/features/auth/pages/signup-page'), 'SignUpPage'),
          },
        ],
      },
      // Fora do redirect: quem já está logado pode aceitar convite de outra conta.
      {
        path: '/invite/:token',
        ...page(() => import('@/features/auth/pages/accept-invite-page'), 'AcceptInvitePage'),
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', ...page(() => import('@/features/home/home-page'), 'HomePage') },
          {
            element: <RequirePermission anyOf={['contacts:view']} />,
            children: [
              {
                path: '/contacts',
                ...page(() => import('@/features/contacts/contacts-page'), 'ContactsPage'),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['members:manage']} />,
            children: [
              {
                path: '/settings/members',
                ...page(() => import('@/features/members/members-page'), 'MembersPage'),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['roles:manage', 'members:manage']} />,
            children: [
              {
                path: '/settings/roles',
                ...page(() => import('@/features/roles/roles-page'), 'RolesPage'),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
