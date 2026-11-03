# Usibar — site e catálogo

Projeto em `/home/alisson/Projetos/usibar` (Ubuntu/WSL). Site local: http://127.0.0.1:3000. Login de edição: /admin.

## Entrega

Visual bege, grafite e laranja; apresentação animada de projeto, usinagem e acionamento; catálogo com oito fotografias reais. A faixa contínua após a abertura foi removida. A logo usa máscara visual para integrar seu fundo à página sem alterar o original. As novas imagens do cilindro com válvula e do manifold longo estão associadas aos produtos. A apresentação institucional recebida permanece em raw.

As animações são ilustrativas: na seção de processo, uma única cena vetorial acompanha a rolagem em qualquer tela, e os textos fazem parte dela: o texto da etapa 1 é escrito no carimbo do desenho técnico, o da etapa 2 é digitado no painel da CNC enquanto a fresa fura o bloco, e o título da etapa 3 é empurrado pela haste do cilindro pressurizado. “Pular animação” leva direto ao catálogo; com movimento reduzido no sistema, cada etapa aparece pronta. As fotografias preservam as peças, com resolução limitada aos originais.

## Edição direto no site

A edição acontece na própria página. Entre em /admin com a senha (ADMIN_PASSWORD); você volta ao início com o modo de edição ativo e uma barra no rodapé da tela. Na primeira vez, um aviso resume como editar.

- textos com contorno tracejado são editados com um clique (Enter confirma, Esc cancela): subtítulo, mensagem institucional, cidade, anos de experiência, parágrafos da empresa, segmentos atendidos e os textos das três etapas do processo — estes direto dentro da animação (carimbo do desenho, painel da CNC e título empurrado pela haste);
- “+ Nova peça” ou o cartão “Cadastrar nova peça” abre o cadastro com foto (arraste ou clique), código, categoria, especificações, nome, descrição e destaque; clicar em uma peça abre a edição dela, com troca de foto e exclusão;
- segmentos podem ser adicionados e removidos na própria lista;
- “Empresa e contatos” reúne nome, slogan, telefone, WhatsApp, e-mail, Instagram e os demais dados.

Cada alteração confirmada é publicada na hora; a barra mostra o que foi salvo e onde (neste computador ou no Supabase). “Desfazer” ou Ctrl+Z revertem as últimas 20 alterações, inclusive exclusões. Se o servidor recusar, a página volta ao último estado salvo e mostra o motivo.

## Supabase (armazenamento durável)

Sem configuração, o conteúdo fica em data/db.json e as fotos em data/uploads. Com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidos, o servidor passa a gravar no Supabase — e a edição fica disponível também na Vercel. A chave service role é usada só no servidor.

1. Crie um projeto no Supabase e aplique `supabase/migrations/20261103000000_site_content.sql` (SQL Editor ou `supabase db push`). Ela cria a tabela `site_content` (um documento JSON), o histórico `site_content_history` (últimas 100 versões, por gatilho) e o bucket público `catalog` para as fotos em WebP. As tabelas têm RLS ativo e nenhuma política: só o servidor acessa.
2. Coloque SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local (e, na Vercel, nas variáveis do projeto junto com ADMIN_PASSWORD).
3. Copie o catálogo atual: `node --env-file=.env.local scripts/supabase-seed.mjs` (envia também as fotos de data/uploads).

Enquanto a tabela estiver vazia, o site exibe o catálogo publicado com o código. O próximo passo natural é trocar a senha única por login do Supabase Auth.

## Rodar em outra máquina

Instale Node.js 24 e execute na raiz:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Defina uma senha própria em ADMIN_PASSWORD para editar o site localmente. A senha local existente foi entregue separadamente e não integra o Git ou ZIP. Para compilar: `npm run build`; para executar produção: `npm start`.

Os assets WebP estão prontos em public/assets. Após trocar originais/mapeamentos, execute `npm run assets` e inclua os WebP atualizados no Git.

## Git e Vercel — demonstração

O repositório local está na branch main. Crie um repositório vazio no seu provedor Git e conecte-o:

```sh
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Na Vercel, importe esse repositório. Escolha a raiz do projeto, framework Next.js e Node.js 24. A configuração versionada usa `npm ci` para instalação e `npm run build` para compilação. Não é necessário configurar ADMIN_PASSWORD na demonstração.

Na Vercel sem Supabase, o modo demonstração é automático: catálogo público e contatos funcionam, enquanto login, edição e upload ficam bloqueados. Com o Supabase configurado (seção acima), a edição funciona também lá. Os dados e imagens são publicados junto com o código. Para atualizar a demonstração, edite localmente e envie um novo commit. O disco das funções não é um banco persistente; uma futura edição online exige banco e armazenamento de arquivos externos.

Para ensaiar o modo demonstração localmente após compilar:

```sh
DEMO_MODE=true npm start -- --port 3002
```

Credenciais, uploads locais, dependências, ferramentas e builds estão excluídos do Git. Antes de publicar um produto com foto enviada pelo painel local, copie a imagem para public/assets e atualize seu imageUrl no catálogo.

Nenhum repositório remoto ou deployment foi criado nesta preparação.

## Validação

`npm test`: testes de validação, sessões, modo demonstração e armazenamento (arquivo e Supabase, com respostas simuladas). `node --env-file=.env.local tests/integration.mjs`: integração local (servidor em 3000; cria e restaura dados de teste). `node tests/demo-integration.mjs`: leitura pública e bloqueio de alterações no servidor de demonstração em 3002.
