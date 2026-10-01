# Orbis Gestão — publicação na Cloudflare

Este pacote contém o código-fonte completo da versão comercial 53.

## Opção recomendada: GitHub + Cloudflare Workers

1. Crie um repositório privado no GitHub chamado `orbis-gestao`.
2. Envie o conteúdo deste ZIP para o repositório. Não envie o ZIP fechado: extraia primeiro.
3. Na Cloudflare, abra **Workers & Pages** e conecte o repositório.
4. Use Node.js 22 ou superior.
5. Configure o comando de build:

   `pnpm install --frozen-lockfile && pnpm build`

6. Configure o comando de deploy:

   `npx wrangler deploy --config dist/server/wrangler.json`

7. Nas variáveis de build, cadastre:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Use apenas a chave publicável. Nunca use `service_role` no site.

## Depois da primeira publicação

Copie o endereço `workers.dev` fornecido pela Cloudflare. No Supabase, abra
**Authentication > URL Configuration** e configure:

- **Site URL:** o endereço completo da Cloudflare.
- **Redirect URLs:** o mesmo endereço terminado em `/**`.

Exemplo:

`https://orbis-gestao.seu-subdominio.workers.dev/**`

## Domínio próprio

No Worker, abra **Settings > Domains & Routes > Add Custom Domain** e informe o
domínio ou subdomínio desejado, por exemplo `sistema.ercreative.com.br`. Depois,
troque também o Site URL e adicione o novo endereço nas Redirect URLs do Supabase.

## Publicação pelo computador

Com Node.js 22 e pnpm instalados:

1. Copie `.env.example` para `.env.local` e preencha a chave publicável.
2. Execute `pnpm install`.
3. Execute `pnpm deploy:cloudflare`.
4. O navegador solicitará autorização da sua conta Cloudflare na primeira vez.

## Banco de dados

O banco continua no Supabase atual. Não execute novamente as SQLs em um banco que
já está na versão 19.
