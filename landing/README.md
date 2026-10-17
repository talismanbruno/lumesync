# Lume landing page

Landing pública do Lume. A abertura, o texto e o perfil animado foram aprovados em preview local. As capturas mostram a interface real com contas e mensagens fictícias; o perfil usa o componente real de personalização do aplicativo.

- Vercel: selecione `landing` como **Root Directory** e deixe o framework como **Other**.
- GitHub Pages: publique o conteúdo desta pasta na raiz da branch escolhida.

O build publica a landing na raiz `/`, com assets em `/site/`, por meio de `scripts/package-landing.mjs`. O aplicativo usa `/app/`. Links antigos de login, canais e convites redirecionam para o novo caminho. Clientes Electron e Android já instalados são encaminhados da raiz para `/app/`, e o PWA inicia em `/app/channels/@me`. O perfil de demonstração só aceita incorporação pela mesma origem.

Os downloads consultam as releases públicas, incluindo beta, para escolher o instalador compatível mais recente. Quando o navegador do Mac não informa a arquitetura, a página pede Apple Silicon ou Intel e memoriza a escolha.

O perfil é distribuído pré-compilado em `assets/profile`. Sua entrada e dados fictícios estão em `profile-source`, e podem ser recompilados com `node scripts/build-landing-profile.mjs`. O componente e as regras de animação vêm de `packages/web/src/components/modals/settingsPanels/ProfileCustomizationEditor` e `packages/web/src/components/ui/ProfileCosmetics`.
