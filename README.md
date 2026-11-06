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
7. **Orçamento em etapas** — uma pergunta por vez (produto, aplicação, quantidade, desenho), com cartões grandes, progresso, voltar e pular; na revisão o cliente confere tudo e envia pelo WhatsApp ou por e-mail. Ao lado, contato direto com ícones, endereço completo (Rua Martin Biancho, 803 — Bairro Bela Vista, Barão/RS, CEP 95730-000) e “como chegar”. Nada é armazenado.

Logo e navegação: a abertura mostra a logo grande (vetorizada a partir do original em raw/image_14.jpg, nítida em qualquer tamanho) e ela voa para o cabeçalho, onde aparece em tamanho maior. A logo completa — micrômetro e “USIBAR” — fica visível o tempo todo: em telas largas, ao rolar, ela permanece no canto superior esquerdo como um selo sobre placa clara, enquanto cada item do menu do cabeçalho viaja até a sua estação no cilindro à direita, que passa a ser o índice da página (número e nome de cada seção, a atual em destaque, a haste avançando até ela e o botão “Índice” embaixo). O índice tem margem própria (o conteúdo não passa por baixo) e fica claro sobre seções escuras; ao voltar ao topo, o menu volta ao cabeçalho. Em telas menores, o cabeçalho com a logo fica sempre fixo no topo. O botão do WhatsApp fica sempre no canto inferior direito, com mensagem inicial editável. Metadados de compartilhamento e dados estruturados (schema.org) usam os contatos reais. As animações e desenhos são ilustrativos; as fotografias preservam as peças, com resolução limitada aos originais.

## Edição direto no site

A edição acontece na própria página. Entre em /admin com e-mail e senha (Supabase Auth); você volta ao início com o modo de edição ativo e uma barra no rodapé da tela. Na primeira vez, um aviso resume como editar.

- praticamente todo texto da página tem contorno tracejado e é editado com um clique (Enter confirma, Esc cancela): títulos e rótulos de todas as seções, botões, menu, faixa de fatos, legendas da foto do topo, carimbo e painel da animação do processo, textos do orçamento e do rodapé. Os textos fixos ficam em `copy` (chave → texto); o padrão está no código, então campos novos nunca exigem migração;
- fotos do topo, da empresa e das soluções têm o botão “Trocar foto” no próprio lugar (as legendas técnicas do topo só aparecem sobre a foto original, que é onde apontam);
- “+ Nova peça” ou o cartão “Cadastrar nova peça” abre o cadastro com foto (arraste ou clique), código, categoria, especificações, nome, descrição e destaque; clicar em uma peça abre a edição dela, com troca de foto e exclusão;
- segmentos podem ser adicionados e removidos na própria lista;
- “Empresa e contatos” reúne nome, slogan, lema, telefone, WhatsApp, e-mail, endereço, cidade, CEP, parágrafos e as redes sociais (Instagram, Facebook, LinkedIn, YouTube, TikTok, X ou site), que aparecem com ícone no contato, no índice e no rodapé.

Cada alteração confirmada é publicada na hora; a barra mostra o que foi salvo e onde (no Supabase ou, em desenvolvimento local, neste computador). “Desfazer” ou Ctrl+Z revertem as últimas 20 alterações, inclusive exclusões. Se o servidor recusar, a página volta ao último estado salvo e mostra o motivo.

### Cor e tamanho, seções e curadoria com IA

- **Cor e tamanho:** ao clicar num texto, uma barra flutuante oferece as cores da marca (ou qualquer outra), tamanho de 60% a 240% e “Restaurar”. Fica salvo em `styles` (chave do texto → cor e escala) e vale também para visitantes.
- **Seções:** cada seção mostra, no modo edição, uma barra com ↑ ↓, Ocultar/Mostrar e Remover/Excluir; entre elas há “+ Inserir seção aqui”. Os modelos novos são Texto com foto, Números, Galeria de fotos, Chamada para contato e Depoimento. Uma seção nova entra oculta para visitantes, para ser preenchida antes de publicar. Numeração, menu, trilho, índice e rodapé acompanham a ordem automaticamente. A ordem fica em `layout`; seções nativas removidas podem ser recolocadas pelo mesmo “Inserir seção”.
- **Texto a texto com IA (Google Gemini):** na barra de texto, “✦ IA” propõe uma versão (Melhorar, Encurtar, Corrigir português, Mais técnico, Mais comercial ou um pedido livre); a proposta pode ser ajustada e só é publicada ao clicar em “Aplicar”.
- **Assistente IA (chat):** “✦ Assistente IA”, na barra de edição, abre um chat ao lado da página. Peça em palavras (“mova Segmentos para depois de Soluções”, “oculte o Processo”, “insira um depoimento”, “mude a cor do título do catálogo para laranja”, “atualize o WhatsApp”, “adicione o LinkedIn”, “revise todos os textos”) e o assistente prepara cartões de ação, cada um com “Aplicar” e “Ignorar” (ou “Aplicar todas”). Fotos podem ser anexadas, arrastadas ou coladas: o Gemini vê a foto e propõe, por exemplo, o cadastro da peça (nome, código no padrão, categoria, recorte do fundo) ou a troca da foto do topo, de uma peça, de uma solução ou de uma seção, e a montagem de galerias. Sugestões prontas ajudam a começar; “Ver no site” rola até o que vai mudar.
  - O que ele pode fazer está em `src/lib/site-actions.mjs`: trocar textos, mudar cor e tamanho, mover, ocultar, mostrar, inserir, renomear e remover seções, preencher seções de modelo, trocar fotos, cadastrar, editar e excluir peças, mudar dados de contato e redes, revisar todos os textos e mostrar algo no site. Senhas, administradores e o desenho do site ficam de fora.
  - Nada muda sem o clique do administrador. Cada ação aplicada passa pelo mesmo caminho da edição manual: validação no servidor, publicação na hora e “↶ Desfazer”. O servidor descarta chamadas que não correspondem ao site atual (seção, peça, texto ou foto inexistente), e as fotos só são enviadas ao armazenamento quando uma ação que as usa é aplicada.
  - As instruções proíbem inventar números, prazos, certificações ou clientes; os fatos vêm do conteúdo salvo, não do navegador.
- **Configuração da IA:** crie a chave no Google AI Studio (aistudio.google.com → Get API key) e defina `GEMINI_API_KEY` nas variáveis de ambiente do servidor (na Vercel: Settings → Environment Variables; localmente, em .env.local) e publique de novo. Opcional: `GEMINI_MODEL` (padrão `gemini-3.5-flash-lite`, o mais econômico). Sem a chave, o restante da edição funciona e a IA mostra como ativá-la. A rota `/api/ai` só atende administradores logados e tem limite de 20 pedidos por minuto por instância. A revisão e as reescritas usam respostas em JSON com esquema fixo; o chat usa chamadas de função do Gemini. O servidor filtra as duas antes de mostrar.

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

### Rede da empresa (proxy que inspeciona HTTPS)

Em redes corporativas o proxy costuma abrir o HTTPS com um certificado próprio. O navegador aceita porque a TI instalou a raiz da empresa no sistema, mas o Node usa a própria lista de certificados e recusa a conexão com o Supabase e com o Gemini (`SELF_SIGNED_CERT_IN_CHAIN` no terminal). O site cai na cópia embutida do conteúdo, a edição fica pausada e a barra de edição e a curadoria avisam “O servidor do site não confiou no certificado…”.

Na rede da empresa, rode o servidor local confiando nos certificados do sistema:

```sh
npm run dev:empresa
```

Se ainda falhar, peça à TI o certificado raiz do proxy em PEM (ou exporte-o pelo cadeado do navegador: certificado › raiz › exportar Base64) e aponte o Node para ele antes do `npm run dev`. No PowerShell: `$env:NODE_EXTRA_CA_CERTS="C:\certificados\raiz-empresa.pem"`. No bash: `export NODE_EXTRA_CA_CERTS=~/raiz-empresa.pem`. Nunca desligue a verificação (`NODE_TLS_REJECT_UNAUTHORIZED=0`): isso aceitaria qualquer certificado, inclusive de um atacante. Na Vercel não há esse proxy, e nada disso é necessário.

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

`npm test`: testes da IA (validação de pedidos e respostas, chat e chamadas de função), das ações do assistente (cada ação aplicada mantém o conteúdo válido), de estilos e seções, de validação, sessão local de desenvolvimento, modo demonstração e armazenamento (arquivo e Supabase, com respostas simuladas, incluindo a verificação de administrador). `USIBAR_STORAGE=file node --env-file=.env.local tests/integration.mjs`: integração local (modo arquivo) (servidor em 3000; cria e restaura dados de teste). `node tests/demo-integration.mjs`: leitura pública e bloqueio de alterações no servidor de demonstração em 3002.
