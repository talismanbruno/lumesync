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

O assistente `Lume.ps1` usa o Node.js 24, o Corepack e o pnpm 10.34.3 declarado pelo projeto. O primeiro uso do pnpm pode precisar de internet. Para instalar ou restaurar as dependências:

```powershell
.\Lume.ps1 instalar
```

O desenvolvimento normalmente abre a interface em `http://localhost:5173` e usa a API na porta 3005. Chamadas dependem da configuração de mídia. Este comando executa o código local.

## Publicar o site e o servidor

1. Na aba **Controle do Código-Fonte** do editor, use **+** ao lado de cada arquivo que deve entrar na publicação. Quem usa terminal pode selecionar com `git add -- caminho-do-arquivo`.
2. Dê dois cliques em **Publicar-Lume.cmd** ou execute `.\Publicar-Lume.ps1` no PowerShell, a partir da pasta do Lume.
3. Confira a lista. Quando puder interromper as chamadas ativas, digite `PUBLICAR`. Se houver arquivos selecionados, informe um nome curto para o commit. Aguarde a mensagem **Publicado**.

O atalho envia os commits da `main`, espera CI, Security e CodeQL no GitHub e só aplica a imagem na Oracle depois que o workflow de publicação termina com sucesso. A promoção faz snapshot do banco e restaura a imagem anterior se a nova falhar na verificação de saúde. Se alguma etapa parar, a janela mostra o motivo ou o link para conferir no GitHub. Depois de resolver, execute o mesmo atalho novamente.

`.\Publicar-Lume.ps1 -Conferir` mostra a seleção e verifica os acessos do GitHub e da Oracle sem publicar. O atalho usa a credencial do GitHub já salva no Git Credential Manager e a chave local em `.deploy-local/ssh/oracle-lume-core`. Para gerar novos instaladores desktop ou APK, use o workflow separado de [releases do Lume](docs/systems/deployment.md#unified-lume-releases).

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
