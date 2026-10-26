# Lume landing page

Landing pública do Lume. A abertura, o texto e o perfil animado foram aprovados em preview local. As capturas mostram a interface real com contas e mensagens fictícias; o perfil usa o componente real de personalização do aplicativo.

- Vercel: selecione `landing` como **Root Directory** e deixe o framework como **Other**.
- GitHub Pages: publique o conteúdo desta pasta na raiz da branch escolhida.

O build publica a landing na raiz `/`, com assets em `/site/`, por meio de `scripts/package-landing.mjs`. O aplicativo usa `/app/`. Links antigos de login, canais e convites redirecionam para o novo caminho. Clientes Electron e Android já instalados são encaminhados da raiz para `/app/`, e o PWA inicia em `/app/channels/@me`. O perfil de demonstração só aceita incorporação pela mesma origem.

No navegador, a raiz confirma a sessão salva com `/api/users/@me`: sessão válida abre `/app/`; sem sessão ou com sessão expirada, mostra a landing. Falhas de rede não apagam a sessão. Essa verificação não é executada no GitHub Pages.

Os downloads consultam as releases públicas, incluindo beta, para escolher o instalador compatível mais recente. Quando o navegador do Mac não informa a arquitetura, a página pede Apple Silicon ou Intel e memoriza a escolha.

A seção #desempenho apresenta o teste manual informado pelo responsável pelo
Lume em 26/10/2026: abertura após iniciar o PC (Lume 4,22 s; Discord 19,81 s)
e RAM durante chamada (274 MB; 612 MB). Os resultados são de um único PC, não
foram verificados de forma independente e não equivalem a uma garantia de
desempenho em outros equipamentos. A nota pública mantém esse contexto.

O arquivo performance.js reproduz os tempos medidos uma vez ao entrar na seção,
permite repetir manualmente, respeita movimento reduzido e pausa a contagem
quando a página fica oculta ou o controle de movimento é pausado. Os destaques
de arquivos de até 100 MB e compartilhamento de tela em até Full HD a 60 FPS
descrevem recursos do produto; não são resultados do comparativo.

O perfil é distribuído pré-compilado em `assets/profile`. Sua entrada e dados fictícios estão em `profile-source`, e podem ser recompilados com `node scripts/build-landing-profile.mjs`. O componente e as regras de animação vêm de `packages/web/src/components/modals/settingsPanels/ProfileCustomizationEditor` e `packages/web/src/components/ui/ProfileCosmetics`.
