import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Fronteiras de arquitetura (ver Backend/CLAUDE.md):
 * - dependências apontam para dentro: http → application → domain; infra → application/domain
 * - domain não importa nenhum pacote externo
 * - um módulo só enxerga outro pelo index.ts dele
 * - pastas testing/ só podem ser importadas por arquivos .spec.ts
 *
 * Elementos classificam PASTAS (o primeiro padrão que casar vence, por isso
 * as camadas vêm antes de `module` e `app`); categorias classificam ARQUIVOS.
 */
const sameModule = { module: '{{from.element.captured.module}}' };
const own = (type) => ({ element: { type, captured: sameModule } });
const shared = (...types) => types.map((type) => ({ element: { type } }));
const anyModulePublicApi = { element: { type: 'module' }, file: { categories: 'public-api' } };

export default defineConfig(
  {
    ignores: ['dist/', 'node_modules/', 'eslint.config.mjs', 'src/shared/infra/prisma/generated/'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/elements': [
        { type: 'config', pattern: 'src/config' },
        { type: 'health', pattern: 'src/health' },
        { type: 'shared-domain', pattern: 'src/shared/domain' },
        { type: 'shared-application', pattern: 'src/shared/application' },
        { type: 'shared-infra', pattern: 'src/shared/infra' },
        { type: 'shared-http', pattern: 'src/shared/http' },
        { type: 'shared-testing', pattern: 'src/shared/testing' },
        { type: 'domain', pattern: 'src/modules/*/domain', capture: ['module'] },
        { type: 'application', pattern: 'src/modules/*/application', capture: ['module'] },
        { type: 'infra', pattern: 'src/modules/*/infra', capture: ['module'] },
        { type: 'http', pattern: 'src/modules/*/http', capture: ['module'] },
        { type: 'testing', pattern: 'src/modules/*/testing', capture: ['module'] },
        // Arquivos na raiz do módulo: index.ts e <modulo>.module.ts
        { type: 'module', pattern: 'src/modules/*', capture: ['module'] },
      ],
      'boundaries/files': [
        { category: 'test', pattern: '**/*.spec.ts' },
        { category: 'public-api', pattern: 'src/modules/*/index.ts' },
        // main.ts, app.module.ts
        { category: 'app-root', pattern: 'src/*.ts' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Shared kernel
            {
              from: { element: { type: 'shared-domain' } },
              allow: { to: shared('shared-domain') },
            },
            {
              from: { element: { type: 'shared-application' } },
              allow: { to: shared('shared-application', 'shared-domain') },
            },
            {
              from: { element: { type: 'shared-infra' } },
              allow: {
                to: shared('shared-infra', 'shared-application', 'shared-domain', 'config'),
              },
            },
            {
              from: { element: { type: 'shared-http' } },
              allow: { to: shared('shared-http', 'shared-application', 'shared-domain') },
            },
            {
              from: { element: { type: 'shared-testing' } },
              allow: { to: shared('shared-testing', 'shared-application', 'shared-domain') },
            },

            // Raiz da aplicação
            { from: { element: { type: 'config' } }, allow: { to: shared('config') } },
            {
              from: { element: { type: 'health' } },
              allow: { to: shared('health', 'shared-infra') },
            },
            {
              from: { file: { categories: 'app-root' } },
              allow: {
                to: [
                  { file: { categories: 'app-root' } },
                  ...shared('config', 'health', 'shared-infra', 'shared-http'),
                  anyModulePublicApi,
                ],
              },
            },

            // Camadas de cada módulo (sempre do PRÓPRIO módulo)
            {
              from: { element: { type: 'domain' } },
              allow: { to: [own('domain'), ...shared('shared-domain')] },
            },
            {
              from: { element: { type: 'application' } },
              allow: {
                to: [
                  own('application'),
                  own('domain'),
                  ...shared('shared-application', 'shared-domain'),
                  anyModulePublicApi,
                ],
              },
            },
            {
              from: { element: { type: 'infra' } },
              allow: {
                to: [
                  own('infra'),
                  own('application'),
                  own('domain'),
                  ...shared('shared-infra', 'shared-application', 'shared-domain'),
                ],
              },
            },
            {
              from: { element: { type: 'http' } },
              allow: {
                to: [
                  own('http'),
                  own('application'),
                  own('domain'),
                  ...shared('shared-http', 'shared-application'),
                ],
              },
            },
            {
              from: { element: { type: 'module' } },
              allow: {
                to: [
                  own('module'),
                  own('domain'),
                  own('application'),
                  own('infra'),
                  own('http'),
                  anyModulePublicApi,
                ],
              },
            },
            {
              from: { element: { type: 'testing' } },
              allow: {
                to: [
                  own('testing'),
                  own('application'),
                  own('domain'),
                  ...shared('shared-application', 'shared-domain', 'shared-testing'),
                ],
              },
            },

            // Fakes (testing/) só entram em arquivos de teste.
            {
              from: { file: { categories: 'test' } },
              allow: { to: [own('testing'), ...shared('shared-testing')] },
            },
          ],
        },
      ],
    },
  },
  {
    // O plugin de fronteiras só enxerga imports de dentro de src/. A pureza do
    // domínio (nenhum pacote externo, nem do Node) é garantida por esta regra.
    files: ['src/modules/*/domain/**/*.ts', 'src/shared/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.)',
              message: 'O domínio é TypeScript puro: só imports relativos (sem pacotes externos).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
