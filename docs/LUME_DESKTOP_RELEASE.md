# Publicação e atualizações do Lume Desktop

O fluxo atual é .github/workflows/release.yml (Lume Release). A numeração do aplicativo, instaladores, Android e links web é verificada por scripts/verify-release.mjs. Use tags v<versão>, por exemplo v1.0.0-beta.27. O fluxo histórico lume-desktop-v* não é o processo usado pelas betas atuais.

## Preparar e publicar
1. Confira os releases já publicados antes de escolher a próxima beta; preserve os anteriores.
2. Atualize package.json, packages/desktop/package.json, android/app/build.gradle.kts (incluindo versionCode) e packages/web/src/config/desktopDownloads.ts. Atualize os links de download da landing sem reaproveitar hashes de análises antigas.
3. Execute os testes e builds, escreva docs/releases/v<versão>.md e envie o commit revisado.
4. Execute Lume Release por workflow_dispatch ou envie a tag v<versão>. O pipeline gera Windows x64/ARM64, macOS Intel/Apple Silicon, Linux x64/ARM64 e Android.
5. O finalizador só cria o rascunho quando todos os builds nativos passam. Ele verifica versões, integridade dos instaladores, manifests e checksums, e anexa todos os arquivos.
6. Confira CI, Security e CodeQL, o commit exato, os arquivos completos e as limitações reais antes de publicar o rascunho como pre-release. Não substitua arquivos de versões anteriores.

## Canal de atualização
O Desktop Windows usa electron-updater/NSIS, com a fonte fixada em github.com/talismanbruno/lumesync. São publicados beta.yml e latest.yml consistentes, instaladores e blockmaps; scripts/verify-release.mjs valida os hashes e tamanhos. O comparador SemVer aceita betas superiores e bloqueia downgrade.

As verificações ocorrem dez segundos após abrir, a cada quatro horas e por ação manual. O processo principal evita concorrência durante verificação, download ou pacote pronto. A interface recebe snapshot, progresso e erros reais por IPC. A versão instalada vem de app.getVersion().

O pacote baixa em segundo plano, sem instalar ao sair. Atualizar e reiniciar só atua quando o download terminou e não há chamada. quitAndInstall(true, true) entrega ao NSIS a instalação e a reabertura; não existe watchdog que simplesmente abra o executável antigo.

macOS e Linux continuam com download manual. macOS depende de Developer ID/notarização para atualização automática confiável. O certificado Windows ainda não está configurado no repositório; os hashes e HTTPS não constituem assinatura de publisher.

## Interface web carregada pelo Desktop
O instalador contém o processo principal/preload; a interface é servida pela instância Lume. Assim, correções web também precisam de implantação. O Desktop desregistra somente o service worker do Lume e usa o atualizador nativo. No navegador, as atualizações do cache aguardam confirmação, bloqueada durante chamadas e uploads; nunca devem recarregar uma chamada por ativação automática de worker.

Uma implantação web/servidor pode ter commit posterior ao instalador sem alterar o binário Desktop. O endpoint de instância anuncia o commit efetivamente implantado e lê a versão do package.json da release.

## Provas de execução
Diferencie testes com mocks, reprodução nativa de assets reais, download real pelo atualizador e instalação real sobre uma versão anterior. Apenas o último comprova substituição de executável, reabertura e preservação de sessão autenticada. Consulte docs/releases/v1.0.0-beta.27-validation.md para a evidência desta beta.
