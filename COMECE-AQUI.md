# Lume — comece aqui

Esta é a pasta principal do Lume completo. Ela substitui o caminho antigo `2026-08-29/files-mentioned-by-the-user-codex/lume-main-rollback`.

## Abrir e desenvolver

Abra esta pasta no Codex ou no seu editor. No Windows, dê dois cliques em **Desenvolver-Lume.cmd** para iniciar o servidor e a interface de desenvolvimento.

No PowerShell, dentro desta pasta:

```powershell
.\Lume.ps1 dev
.\Lume.ps1 typecheck
.\Lume.ps1 test
.\Lume.ps1 build
```

O assistente `Lume.ps1` usa o Node 20 local preservado e o pnpm 10.34.3 declarado pelo projeto. O primeiro uso do pnpm pode precisar de internet. Para instalar ou restaurar as dependências:

```powershell
.\Lume.ps1 instalar
```

O desenvolvimento normalmente abre a interface em `http://localhost:5173` e usa a API na porta 3005. Chamadas dependem da configuração de mídia. Este comando executa o código local.

## Onde fica cada parte

| Pasta | Conteúdo |
| --- | --- |
| `packages/web` | Interface do navegador e experiência móvel |
| `packages/server` | API, mensagens em tempo real, banco e administração |
| `packages/shared` | Tipos e regras compartilhados |
| `packages/desktop` | Aplicativo Electron |
| `android` | Aplicativo Android |
| `landing` | Landing page da Lume |
| `docs/systems` | Documentação dos sistemas |
| `deploy/oracle-runtime` | Operação e publicação na Oracle |
| `data` | Dados locais; preserve antes de mudanças |
| `release` | Pacotes de publicação já existentes |
| `.deploy-local` | Ferramentas, acesso privado, referências e registro desta organização |

A configuração local está em `.env`. Ela e `.deploy-local` já são ignoradas pelo Git. Não compartilhe esses arquivos.

## Continuidade do projeto

As melhorias de chamada, conversa, compartilhamento, menus de áudio e configurações estão registradas em [Melhorias locais — 05/10/2026](docs/operations/UI-LOCAL-2026-10-05.md), com verificações e pendências reais. A tradução completa está preparada em [Plano de idiomas](docs/operations/IDIOMAS-PLANO.md) e ainda não foi ativada.

- Repositório: `talismanbruno/lumesync`, branch `main`.
- A pasta foi organizada a partir do commit `8b1869ab`, de 24/09/2026.
- As alterações locais anteriores foram preservadas, incluindo a preparação da beta.19 e o ajuste do script de promoção.
- O README anterior ainda menciona beta.15; essa descrição não representa sozinha o estado do código.
- A implementação completa mantém nomes internos `@backspace/*`. Eles fazem parte das dependências e da compatibilidade do projeto.

As propostas independentes `lume-new`, `lume-design` e `lume-clean` foram descartadas. Três arquivos únicos da antiga proposta de landing foram guardados em `.deploy-local/referencias/landing-alternativa`, e a pesquisa de nomes em `.deploy-local/referencias/pesquisa-de-nome-2026-09-27.md`.

O registro da limpeza e os hashes dos arquivos preservados estão em `.deploy-local/organizacao/manifesto.json`.
