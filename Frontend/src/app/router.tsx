import { createBrowserRouter } from 'react-router'
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/pages/login-page'
import { AppLayout, type RouteHandle } from './layouts/app-layout'
import { CONVERSATION_SCOPES } from './navigation'
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
            element: <RequirePermission anyOf={CONVERSATION_SCOPES} />,
            children: [
              {
                // Segmento opcional: selecionar uma conversa não remonta a página.
                path: '/conversations/:id?',
                handle: { fullBleed: true } satisfies RouteHandle,
                ...page(() => import('@/features/conversations/inbox-page'), 'InboxPage'),
              },
              {
                path: '/boards',
                ...page(() => import('@/features/boards/boards-page'), 'BoardsPage'),
              },
              {
                path: '/boards/:id',
                handle: { fullBleed: true } satisfies RouteHandle,
                ...page(() => import('@/features/boards/board-page'), 'BoardPage'),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['contacts:view']} />,
            children: [
              {
                path: '/contacts',
                ...page(() => import('@/features/contacts/contacts-page'), 'ContactsPage'),
              },
              {
                path: '/contacts/:id',
                ...page(() => import('@/features/contacts/contact-page'), 'ContactPage'),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['channels:manage']} />,
            children: [
              {
                path: '/settings/channels',
                ...page(() => import('@/features/channels/channels-page'), 'ChannelsPage'),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['dispositions:manage']} />,
            children: [
              {
                path: '/settings/dispositions',
                ...page(
                  () => import('@/features/dispositions/dispositions-page'),
                  'DispositionsPage',
                ),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['messaging:manage']} />,
            children: [
              {
                path: '/settings/messaging',
                ...page(() => import('@/features/messaging/messaging-page'), 'MessagingPage'),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['integrations:manage']} />,
            children: [
              {
                path: '/settings/integrations',
                ...page(
                  () => import('@/features/integrations/integrations-page'),
                  'IntegrationsPage',
                ),
              },
            ],
          },
          {
            element: <RequirePermission anyOf={['teams:manage']} />,
            children: [
              {
                path: '/settings/teams',
                ...page(() => import('@/features/teams/teams-page'), 'TeamsPage'),
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
