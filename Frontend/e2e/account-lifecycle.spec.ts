import { expect, test, type Page } from '@playwright/test'

/**
 * Jornada completa de uma conta: cadastro, sessão sobrevivendo ao reload
 * (cookie HttpOnly + refresh), convite, logout e aceite do convite por outra
 * pessoa — que entra com as permissões do cargo Agent.
 *
 * Cria dados reais (e-mails @teste.dev) no banco de desenvolvimento.
 */
const run = Date.now()
const owner = {
  account: `Loja E2E ${run}`,
  name: 'Ana Teste',
  email: `ana.${run}@teste.dev`,
  password: 'super-secret',
}
const guest = { name: 'Bia Teste', email: `bia.${run}@teste.dev`, password: 'outra-senha-123' }

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/.screenshots/${name}.png`, fullPage: true })

test.describe.serial('ciclo de vida da conta', () => {
  let inviteUrl = ''

  test('cadastro abre a sessão, que sobrevive ao reload', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await shot(page, '01-login')

    await page.getByRole('link', { name: 'Criar conta' }).click()
    await page.getByLabel('Nome da empresa').fill(owner.account)
    await page.getByLabel('Seu nome').fill(owner.name)
    await page.getByLabel('E-mail').fill(owner.email)
    await page.getByLabel('Senha').fill(owner.password)
    await shot(page, '02-signup')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    const greeting = page.getByRole('heading', { name: 'Olá, Ana' })
    await expect(greeting).toBeVisible()
    await shot(page, '03-home-owner')

    // O access token vive só em memória: o reload o apaga, e a sessão
    // precisa voltar sozinha pelo cookie HttpOnly.
    await page.reload()
    await expect(greeting).toBeVisible()
  })

  test('Owner convida uma pessoa como Agent e sai', async ({ page }) => {
    await logIn(page, owner.email, owner.password)

    // Trilho de módulos → painel com as telas do módulo
    await page
      .getByRole('navigation', { name: 'Módulos' })
      .getByRole('button', { name: 'Pessoas e acesso' })
      .click()
    await page
      .getByRole('navigation', { name: 'Telas de Pessoas e acesso' })
      .getByRole('link', { name: 'Membros' })
      .click()
    await expect(page.getByRole('cell', { name: /Ana Teste/ })).toBeVisible()
    await page.getByRole('button', { name: 'Convidar' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(guest.email)
    await dialog.getByLabel('Cargo').click()
    await page.getByRole('option', { name: 'Agent' }).click()
    await dialog.getByRole('button', { name: 'Convidar' }).click()

    await expect(dialog.getByText('Convite criado')).toBeVisible()
    inviteUrl = await dialog.getByRole('textbox').inputValue()
    expect(inviteUrl).toContain('/invite/')
    await shot(page, '04-invite-link')
    await dialog.getByRole('button', { name: 'Concluir' }).click()

    await expect(page.getByRole('cell', { name: guest.email, exact: true })).toBeVisible()
    await shot(page, '05-members')

    await page.getByRole('button', { name: /Ana Teste/ }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('convidado cria a conta pelo link e entra com as permissões de Agent', async ({ page }) => {
    await page.goto(inviteUrl)
    await expect(page.getByText('Você foi convidado')).toBeVisible()
    await shot(page, '06-accept-invite')

    await page.getByLabel('Seu nome').fill(guest.name)
    await page.getByLabel('Crie uma senha').fill(guest.password)
    await page.getByRole('button', { name: 'Aceitar convite' }).click()

    await expect(page.getByRole('heading', { name: 'Olá, Bia' })).toBeVisible()
    // Agent não vê o módulo de pessoas
    const rail = page.getByRole('navigation', { name: 'Módulos' })
    await expect(rail.getByRole('button', { name: 'Atendimento' })).toBeVisible()
    await expect(rail.getByRole('button', { name: 'Pessoas e acesso' })).toHaveCount(0)
    await shot(page, '07-home-agent')

    // Agent pode criar contatos...
    await rail.getByRole('button', { name: 'Atendimento' }).click()
    await page
      .getByRole('navigation', { name: 'Telas de Atendimento' })
      .getByRole('link', { name: 'Contatos' })
      .click()
    await page.getByRole('button', { name: 'Novo contato' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Nome').fill('Cliente Teste')
    await dialog.getByLabel('Telefone').fill('123')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    // ...e o erro de regra de negócio da API aparece traduzido.
    await expect(dialog.getByText(/Telefone inválido/)).toBeVisible()
    await dialog.getByLabel('Telefone').fill(`+55 11 9${String(run).slice(-8)}`)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('cell', { name: 'Cliente Teste' })).toBeVisible()
    await shot(page, '08-contacts')

    // ...mas não entra na gestão de membros, nem digitando o endereço.
    await page.goto('/settings/members')
    await expect(page.getByText('Sem permissão')).toBeVisible()
  })

  test('senha errada mostra o erro sem entrar', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(owner.email)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: /^Olá,/ })).toBeVisible()
}
