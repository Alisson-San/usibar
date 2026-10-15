# Usibar — site e catálogo

Projeto em `/home/alisson/Projetos/usibar` (Ubuntu/WSL). Site local: http://127.0.0.1:3000. Painel: /admin.

## Entrega

Visual bege, grafite e laranja; apresentação animada de projeto, usinagem e acionamento; catálogo com oito fotografias reais. A faixa contínua após a abertura foi removida. A logo usa máscara visual para integrar seu fundo à página sem alterar o original. As novas imagens do cilindro com válvula e do manifold longo estão associadas aos produtos. A apresentação institucional recebida permanece em raw.

As animações são ilustrativas. As fotografias preservam as peças, com resolução limitada aos originais.

## Rodar em outra máquina

Instale Node.js 24 e execute na raiz:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Defina uma senha própria em ADMIN_PASSWORD para editar o painel local. A senha local existente foi entregue separadamente e não integra o Git ou ZIP. Para compilar: `npm run build`; para executar produção: `npm start`.

Os assets WebP estão prontos em public/assets. Após trocar originais/mapeamentos, execute `npm run assets` e inclua os WebP atualizados no Git.

## Git e Vercel — demonstração

O repositório local está na branch main. Crie um repositório vazio no seu provedor Git e conecte-o:

```sh
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Na Vercel, importe esse repositório. Escolha a raiz do projeto, framework Next.js e Node.js 24. A configuração versionada usa `npm ci` para instalação e `npm run build` para compilação. Não é necessário configurar ADMIN_PASSWORD na demonstração.

Na Vercel, o modo demonstração é automático: catálogo público e contatos funcionam, enquanto login, edição e upload ficam bloqueados. Os dados e imagens são publicados junto com o código. Para atualizar a demonstração, edite localmente e envie um novo commit. O disco das funções não é um banco persistente; uma futura edição online exige banco e armazenamento de arquivos externos.

Para ensaiar o modo demonstração localmente após compilar:

```sh
DEMO_MODE=true npm start -- --port 3002
```

Credenciais, uploads locais, dependências, ferramentas e builds estão excluídos do Git. Antes de publicar um produto com foto enviada pelo painel local, copie a imagem para public/assets e atualize seu imageUrl no catálogo.

Nenhum repositório remoto ou deployment foi criado nesta preparação.

## Validação

`npm test`: testes de validação, sessões e modo demonstração. `node --env-file=.env.local tests/integration.mjs`: integração local (servidor em 3000; cria e restaura dados de teste). `node tests/demo-integration.mjs`: leitura pública e bloqueio de alterações no servidor de demonstração em 3002.
