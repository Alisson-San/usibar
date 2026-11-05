# Usibar — site e catálogo

Projeto em `/home/alisson/Projetos/usibar` (Ubuntu/WSL). Site local: http://127.0.0.1:3000. Login de edição: /admin.

## Entrega

Visual bege, grafite e laranja, com textos tirados da apresentação institucional (em raw). A página segue a ordem em que um cliente decide:

1. **Topo** — o cilindro apresentado como ficha técnica, com legendas que se desenham (olhal, cabeçote, tirantes), o lema “Tecnologia, força e desempenho em cada movimento.” e a faixa de fatos (anos de experiência, sede, produção sob projeto, CNC).
2. **Soluções** — cilindros, blocos e usinagem, cada um com texto oficial e atalhos para ver os modelos ou já orçar.
3. **Do desenho à peça** — a animação do processo, com os textos dentro dela: o carimbo do desenho técnico, o painel da CNC e o título empurrado pela haste. “Pular animação” leva ao catálogo; com movimento reduzido no sistema, cada etapa aparece pronta.
4. **Catálogo** — oito fotografias reais; no detalhe de uma peça dá para navegar entre modelos, pedir cotação ou incluí-la como referência no orçamento.
5. **Empresa e pilares** — qualidade, parceria, inovação e foco no cliente.
6. **Segmentos** — com ícones técnicos e o destaque em elevadores hidráulicos.
7. **Orçamento guiado** — o cliente escolhe produto, aplicação, quantidade e se tem desenho; a prévia mostra a mensagem exata, enviada pelo WhatsApp ou por e-mail. Nada é armazenado.

O cabeçalho indica a seção atual e se recolhe durante a leitura. Metadados de compartilhamento e dados estruturados (schema.org) usam os contatos reais. As animações e desenhos são ilustrativos; as fotografias preservam as peças, com resolução limitada aos originais.

## Edição direto no site

A edição acontece na própria página. Entre em /admin com e-mail e senha (Supabase Auth); você volta ao início com o modo de edição ativo e uma barra no rodapé da tela. Na primeira vez, um aviso resume como editar.

- textos com contorno tracejado são editados com um clique (Enter confirma, Esc cancela): lema, subtítulo, cidade, anos de experiência, títulos e textos das soluções, parágrafos da empresa, pilares, segmentos e os textos das três etapas do processo — estes direto dentro da animação;
- “+ Nova peça” ou o cartão “Cadastrar nova peça” abre o cadastro com foto (arraste ou clique), código, categoria, especificações, nome, descrição e destaque; clicar em uma peça abre a edição dela, com troca de foto e exclusão;
- segmentos podem ser adicionados e removidos na própria lista;
- “Empresa e contatos” reúne nome, slogan, telefone, WhatsApp, e-mail, Instagram e os demais dados.

Cada alteração confirmada é publicada na hora; a barra mostra o que foi salvo e onde (no Supabase ou, em desenvolvimento local, neste computador). “Desfazer” ou Ctrl+Z revertem as últimas 20 alterações, inclusive exclusões. Se o servidor recusar, a página volta ao último estado salvo e mostra o motivo.

## Supabase (projeto central) e acesso

O site usa um projeto Supabase compartilhado por vários sites; o Usibar ocupa o schema `usibar` e o bucket público `usibar`, isolados por RLS. O banco já vem preparado (não há migrações neste repositório; veja `supabase/README.md`).

**Regra de segurança:** o site nunca usa a chave service role. Tudo usa a chave publicável (embutida por padrão em `src/lib/supabase-config.mjs`; pode ser trocada por NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). As gravações levam o JWT do administrador logado e é o banco que decide.

- **Leitura:** pública, em `usibar.site_content` (id `main`). Enquanto estiver vazia, o site mostra o catálogo embutido no código; a primeira edição salva já cria o registro.
- **Login:** /admin usa e-mail e senha do Supabase Auth, com “Esqueci minha senha” (o link volta para /admin). Após entrar, o site chama `is_site_admin('usibar')`; contas que não administram o site são desconectadas com “Esta conta não administra este site.”
- **Gravação:** o navegador envia `Authorization: Bearer <token>` às rotas /api/company e /api/upload. O servidor confirma com `is_site_admin` e grava como aquele usuário.
- **Administradores:** na barra de edição, “Administradores” lista, adiciona (e-mail + senha de 10+ caracteres) e remove acessos e permite alterar a própria senha, via Edge Function `site-admins`. Se a pessoa já tinha conta, a senha dela não muda.
- **Fotos:** convertidas para WebP (lado maior até 1600 px, qualidade 80, no máximo 1 MB) e enviadas ao bucket `usibar` com cache de 1 ano e nome único.
- **Semente opcional:** `SEED_EMAIL=... SEED_PASSWORD=... node scripts/supabase-seed.mjs` copia data/db.json e as fotos de data/uploads (entra como administrador, só com a chave publicável). Não é necessária se você preferir editar pelo próprio site.

Variáveis na Vercel: opcionais `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_BUCKET`. Remova `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_PASSWORD`.

### Desenvolvimento local sem Supabase

Com `USIBAR_STORAGE=file` (e `ADMIN_PASSWORD` em .env.local) o conteúdo fica em data/db.json e as fotos em data/uploads, e /admin pede só a senha local. Esse modo é ignorado na Vercel.

## Rodar em outra máquina

Instale Node.js 24 e execute na raiz:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Para editar sem Supabase, use USIBAR_STORAGE=file e uma ADMIN_PASSWORD própria; com o padrão, o login é o do Supabase. A senha local existente foi entregue separadamente e não integra o Git ou ZIP. Para compilar: `npm run build`; para executar produção: `npm start`.

Os assets WebP estão prontos em public/assets. Após trocar originais/mapeamentos, execute `npm run assets` e inclua os WebP atualizados no Git.

## Git e Vercel — demonstração

O repositório local está na branch main. Crie um repositório vazio no seu provedor Git e conecte-o:

```sh
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Na Vercel, importe esse repositório. Escolha a raiz do projeto, framework Next.js e Node.js 24. A configuração versionada usa `npm ci` para instalação e `npm run build` para compilação. 

Na Vercel a edição usa o Supabase (seção acima). O modo demonstração, somente leitura, é ativado com DEMO_MODE=true: catálogo público e contatos funcionam, enquanto login, edição e upload ficam bloqueados.

Para ensaiar o modo demonstração localmente após compilar:

```sh
DEMO_MODE=true npm start -- --port 3002
```

Credenciais, uploads locais, dependências, ferramentas e builds estão excluídos do Git. Antes de publicar um produto com foto enviada pelo painel local, copie a imagem para public/assets e atualize seu imageUrl no catálogo.

Nenhum repositório remoto ou deployment foi criado nesta preparação.

## Validação

`npm test`: testes de validação, sessão local de desenvolvimento, modo demonstração e armazenamento (arquivo e Supabase, com respostas simuladas, incluindo a verificação de administrador). `USIBAR_STORAGE=file node --env-file=.env.local tests/integration.mjs`: integração local (modo arquivo) (servidor em 3000; cria e restaura dados de teste). `node tests/demo-integration.mjs`: leitura pública e bloqueio de alterações no servidor de demonstração em 3002.
