# Fluxo de trabalho (Git e Vercel)

## Branches

| Branch | Papel | Vercel |
| --- | --- | --- |
| `main` | Produção: o que está no domínio oficial. Só recebe merge vindo da `develop` (ou correção urgente). | Production |
| `develop` | Testes: junta as alterações aprovadas para conferência antes de publicar. | Preview fixa da branch |
| `feature/…`, `fix/…` | Uma alteração por branch, criada a partir da `develop`. | Preview por PR |

## Passo a passo

1. Atualize a `develop` e crie a branch de trabalho:
   ```sh
   git checkout develop && git pull
   git checkout -b feature/nome-curto
   ```
2. Faça os commits e abra um PR **para a `develop`**. O CI roda testes, tipos e build, e a Vercel gera uma prévia.
3. Conferido na prévia, faça o merge na `develop`. A prévia da `develop` passa a mostrar o conjunto em teste.
4. Testado e aprovado, abra um PR **da `develop` para a `main`**. O merge publica em produção.
5. Correção urgente em produção: branch `fix/…` a partir da `main`, PR para a `main` e depois merge da `main` de volta na `develop`.

## Configuração recomendada

- **Vercel → Settings → Git:** Production Branch = `main`.
- **Vercel → Settings → Environment Variables:** `GEMINI_API_KEY` em Production **e** Preview, para a IA funcionar nas prévias de teste.
- **GitHub → Settings → Branches:** proteger `main` e `develop` (exigir PR e o check **CI / check** verde; na `main`, exigir aprovação).

## Antes de abrir um PR

```sh
npm test
npm run typecheck
npm run build
```
