# Compartilhamento de tela: diagnóstico e plano de isolamento de áudio

Data: 23/10/2026. Estado: correção implementada no cliente compartilhado; publicação autorizada pelo usuário. A investigação abaixo registra o comportamento anterior.

Implementação: `screenShareAudioPolicy.ts` separa guia isolada de áudio de sistema. A captura agora ocorre diretamente antes de publicar, preserva `windowAudio`, verifica a restrição retornada e tenta aplicá-la quando suportada. Áudio global não confirmado é interrompido antes da publicação; vídeo e chamada continuam com aviso. Encerramento, desconexão e falhas de publicação liberam as faixas. Não há corte por fala. O caminho vale para web/PWA e clientes Electron que carregam esta versão web; não adiciona áudio interno ao APK nem um cliente iOS. Os testes instrumentais com duas/três pessoas e a matriz de dispositivos permanecem necessários para validar o resultado sonoro em cada sistema, especialmente quando o navegador declara isolamento mas não o aplica corretamente.

## Relato e conclusão

No Brave em Windows 11, quem assiste à transmissão ouve a própria voz ao compartilhar uma tela inteira ou uma janela. Compartilhar outra guia do navegador não apresenta o problema relatado.

O mecanismo mais provável é retorno digital pela captura: a voz de B toca no computador de A, entra no áudio compartilhado por A e chega novamente a B. A diferença entre guia e tela/janela é compatível com a captura de uma fonte isolada versus uma mistura que inclui a saída da chamada. O tipo da imagem compartilhada não determina sozinho a fonte de áudio.

Há um defeito confirmado no Lume: a proteção contra recaptura do próprio áudio é solicitada, mas seu resultado não é validado no navegador, e o áudio já é publicado antes de qualquer inspeção. Ainda não foi realizada uma reprodução instrumental com dois participantes no Brave. Portanto, não está demonstrado se o gatilho específico é restrição ignorada, isolamento incompleto de Web Audio, configuração da fonte, ou comportamento do navegador. Não atribuir o problema ao Brave sem essa reprodução.

## Evidência coletada

1. Produção consultada em `https://lumesocial.online/api/instance/info`: commit `66d849d20dd9a3c58e67be53379728915c047939`, igual ao checkout analisado. O campo de versão do servidor retorna `1.0.0-beta.19`; não confundir isso com a versão dos instaladores.
2. Entrada web publicada: `/assets/index-DP397XQJ.js`. Contém `restrictOwnAudio`; a entrada não contém `windowAudio` ou `getSupportedConstraints`. A conclusão sobre o comportamento vem da leitura do código correspondente, e não apenas dessas buscas no bundle.
3. `packages/web/src/utils/screenShare.ts`, `startScreenShare`: envia `audio.restrictOwnAudio: true` como preferência, mantém `echoCancellation`, `noiseSuppression` e `autoGainControl` desligados na faixa de transmissão, e usa `setScreenShareEnabled` para capturar e publicar.
4. O LiveKit instalado é `2.17.1`. Sua conversão de opções preserva o objeto `audio`; portanto, não há evidência de que esteja descartando `restrictOwnAudio`. A conversão não repassa `windowAudio`, o que precisa ser considerado ao implementar a política de fonte por janela. Não basta adicionar esse campo ao objeto do Lume.
5. O bloco de inspeção em `screenShare.ts` só executa para Electron. Mesmo nele, apenas `restrictOwnAudio === false` gera aviso. Ausência da propriedade não é tratada; a transmissão continua. No navegador não há essa inspeção.
6. O SDK publica as faixas ao executar `setScreenShareEnabled`; uma validação posterior não impede os primeiros pacotes de áudio contaminado.
7. `GlobalAudioRenderer.tsx` e `useAudioTrackPlayer.ts`: as vozes remotas e o áudio de transmissões são reproduzidos em Web Audio, via `AudioManager` e saída do contexto. Os elementos HTML de manutenção ficam mudos. A saída audível pode ser recapturada por áudio de sistema. O caminho Web Audio precisa participar da reprodução comparativa.
8. `GlobalAudioRenderer` aplica ganho 2x à transmissão. Isso pode tornar o retorno mais perceptível, mas não explica sua origem. A inspeção não encontrou uma ligação direta do barramento de saída ao publicador da transmissão; a hipótese principal é recaptura pelo sistema.
9. Desktop: `packages/desktop/src/main.ts` retorna `audio: 'loopback'` para telas e janelas. Selecionar uma janela não implica áudio exclusivo daquela janela nesse caminho. `packages/desktop/package.json` fixa Electron `43.4.0` e versão do aplicativo `1.0.0-beta.23`.
10. Android: `MainActivity.kt` publica a tela por `ScreenCaptureParams(projectionData)`. Não existe nesta integração uma configuração explícita de captura de áudio interno. A sessão auxiliar recebe token sem assinatura de áudio remoto (`canSubscribe: false`), mas a chamada principal continua tocando no WebView. Precisamos verificar as faixas efetivamente publicadas pelo SDK; não declarar suporte a áudio interno só por existir uma imagem de tela.
11. Não há projeto nativo iOS no repositório. Safari/PWA e eventual app iOS são escopos diferentes.
12. O executável Brave encontrado em `C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe` informa versão de arquivo/produto `156.1.98.60`. Isso não comprova a versão do processo que estava aberto durante o incidente; registrar a versão efetiva na reprodução.

Validação executada: `screenShare.test.ts` e `GlobalAudioRenderer.test.tsx`, **11 testes aprovados**. Os testes simulam captura/reprodução e não medem recaptura real, nem cobrem isolamento por sistema, navegador e superfície.

## Fundamento e limites

- O Chrome documenta que o áudio do sistema inclui as vozes da videoconferência e pode devolvê-las aos participantes. Também oferece controles diferentes para áudio de guia e sistema. [Chrome: controles de compartilhamento](https://developer.chrome.com/docs/web-platform/screen-sharing-controls).
- `restrictOwnAudio` é um pedido ao navegador para excluir o som produzido pelo documento capturador. Não reconhecer a propriedade, suportá-la e aplicá-la à fonte são situações distintas. A especificação ainda é um rascunho; não é uma garantia universal de isolamento. [W3C: Screen Capture](https://www.w3.org/TR/2026/WD-screen-capture-20260716/#extensions-to-mediatrackconstraintset).
- O suporte foi anunciado no Chrome 141, mas isso não garante o comportamento de todos os derivados, sistemas ou fontes. Não usar apenas a versão no user agent como autorização para capturar áudio global. [Notas do Chrome 141](https://developer.chrome.com/release-notes/141).
- `suppressLocalAudioPlayback` tem outra função: suprime a reprodução local da guia capturada, mantendo sua captura. Não equivale a excluir a chamada da transmissão. [W3C: propriedades de áudio](https://www.w3.org/TR/2026/WD-screen-capture-20260716/).
- O Electron corrigiu o descarte de `restrictOwnAudio` no manipulador de captura, com backport em **43.4.0**, já declarado neste projeto. A correção é condicionada a plataformas compatíveis; atualizar a versão, sozinho, não é diagnóstico nem garantia. [Electron #52455](https://releases.electronjs.org/pr/52455).

## Resultado desejado

O transmissor continua ouvindo a chamada. Quem assiste ouve o jogo, vídeo ou aplicativo compartilhado e as vozes normais da chamada, sem receber de volta sua própria voz pela transmissão. O microfone permanece uma publicação separada.

Não resolver cortando o som da transmissão quando alguém fala, desligando a chamada do transmissor, reduzindo o ganho geral ou aplicando supressão de ruído à música. Cancelamento de eco do microfone continua sendo importante para alto-falantes, mas não substitui isolamento da captura de sistema.

## Plano de execução

### 1. Reproduzir e identificar a condição exata — prioridade imediata

- Dois clientes com usuários de demonstração, primeiro em chamada direta e depois em canal de voz. A é o transmissor; B é o ouvinte.
- Começar no Brave/Windows 11 do relato. Registrar versão do navegador e Chromium efetivos, build do Windows, versão web e runtime desktop quando aplicável.
- Usar fones e deixar o microfone de A sem publicação. B fala ou envia um sinal de teste. Se B continuar se ouvindo pela transmissão, o retorno não depende do microfone de A.
- Repetir com áudio compartilhado desligado e com B deixando de assistir. O retorno esperado desaparece; isso localiza a segunda cópia na faixa de transmissão.
- Testar guia externa, janela de outro aplicativo, janela do mesmo navegador e monitor inteiro, registrando separadamente fonte de vídeo e opção de áudio escolhida. Registrar se a guia compartilhada é a própria guia do Lume.
- Capturar no início: `getSupportedConstraints`, restrições solicitadas, `getCapabilities` e `getSettings` da faixa de áudio quando disponíveis, `displaySurface` da faixa de vídeo e quantidade/estado das faixas. Ausência de propriedade é **desconhecido**, não sucesso.
- Comparar reprodução remota pelo caminho atual Web Audio e por um caminho HTML de diagnóstico isolado, sem som duplicado. Isso é experimento, não mudança automática do sistema de volumes.
- Testar `restrictOwnAudio` ligado/desligado e, quando suportado, reaplicado/confirmado antes da publicação. Não usar `exact` ou `min` na chamada inicial de `getDisplayMedia`, que tem restrições próprias; uma eventual exigência via `applyConstraints` deve tratar rejeição e desconhecimento.
- Repetir em Chrome/Edge no mesmo PC. Não alterar flags, proteções do Brave ou dispositivos de áudio do usuário para mascarar o problema.
- Não registrar falas, nomes de janelas, tokens ou IDs de dispositivos em telemetria. Para medir, usar sinais de teste locais e registrar apenas metadados e resultados.

Entrega desta etapa: cenário reproduzível e classificação do gatilho — proteção indisponível, ignorada, declarada mas ineficaz, fonte não isolada ou outro defeito comprovado.

### 2. Corrigir a decisão e o momento de publicar — web/PWA e desktop

- Criar um módulo comum, por exemplo `screenShareAudioPolicy.ts`, com estados explícitos: áudio de fonte isolada, áudio de sistema com isolamento validado, captura sem áudio e isolamento indisponível/desconhecido. A decisão usa fonte, capacidade e faixa retornada, não apenas nome do navegador ou toggle.
- Separar **capturar → inspecionar/selecionar faixas → publicar**. O microfone não faz parte dessa mistura. Se o SDK atual não permitir essa inspeção com as opções necessárias, usar `getDisplayMedia` diretamente e publicar as faixas aprovadas pelo LiveKit, ou atualizar o SDK após revisar a conversão real das opções. Não editar `node_modules` como solução.
- Preservar a ativação do clique para abrir o seletor. Nenhuma consulta assíncrona deve consumir o gesto antes da captura.
- No navegador, preferir áudio da fonte selecionada quando disponível. Avaliar `windowAudio: 'window'`, `systemAudio` e `selfBrowserSurface` como controles auxiliares, não prova de isolamento. A versão instalada do SDK precisa de adaptação explícita para `windowAudio`.
- Consultar suporte antes da captura e configurações depois. `getSupportedConstraints() === true` isoladamente não basta; `getSettings().restrictOwnAudio === true` também precisa de validação funcional para a combinação de plataforma e caminho de áudio adotada.
- Enquanto uma combinação não estiver validada, não publicar áudio global que possa incluir a chamada. Continuar o vídeo e a chamada, informar que aquele modo está sem áudio e oferecer compartilhar uma guia com áudio ou usar o desktop compatível. Não substituir silenciosamente a preferência persistida do usuário.
- Se o usuário recusar esse modo, parar as novas faixas e cancelar o início. Não reabrir seletores automaticamente.
- Reavaliar ao trocar a fonte, reiniciar captura, reconectar e trocar saída de áudio. Se for necessário recapturar, exigir novo clique. Ao detectar perda de isolamento, retirar primeiro a faixa de áudio da transmissão, preservando vídeo e chamada quando possível.
- Tratar cancelamento, publicação parcial, faixa encerrada, chamada encerrada durante o seletor e dois cliques concorrentes. Garantir limpeza de faixas e dos estados de transmissão.
- Manter o comportamento de volume, mudo, ensurdecimento e atenuação opcional. Nada de voltar a silenciar a transmissão usando o indicador de fala do ouvinte.

### 3. Validar os caminhos nativos e limites de cada plataforma

| Plataforma | Situação encontrada | Trabalho e condição de aceite |
|---|---|---|
| Brave, Chrome e Edge / Windows 11 | Web usa pedido de exclusão sem verificar resultado | Prioridade 1. Reproduzir os três modos, validar Web Audio e fonte. Sem áudio global quando não for possível comprovar isolamento; guia externa com áudio deve continuar funcionando. |
| Navegadores / Windows 10, macOS, Linux e ChromeOS, quando suportados pelo produto | Código web comum, capacidades de captura diferentes | Testar capacidades por sistema/superfície. Mostrar modo indisponível corretamente. Não transportar conclusões de Windows 11 para os demais sistemas. |
| PWA instalada | Mesmo motor web e caminho de captura do navegador | Aplicar a mesma política; testar atualização do service worker e cliente antigo ainda aberto. PWA não ganha isolamento nativo por estar instalada. |
| Firefox e Safari no desktop | Fluxo web genérico; áudio de sistema não pode ser presumido | Oferecer captura suportada e fallback sem áudio. Assistir a uma transmissão deve funcionar independentemente de conseguir transmitir áudio do sistema. |
| Lume desktop / Windows x64 | Electron 43.4.0, captura `loopback` para tela e janela | Confirmar Electron/Chromium reais do instalador e resultado de exclusão. Se o caminho integrado falhar, fazer prova técnica de captura por aplicação/processo, excluindo a árvore do Lume. Não usar loopback global sem exclusão como substituto. |
| Lume desktop / macOS Intel e Apple Silicon | Electron com caminho de captura nativo dependente de versão/permissões | Testar cada arquitetura e versão suportada, permissão negada e faixa encerrada/silenciosa. Se precisar de captura própria, investigar APIs nativas com exclusão de processo. Não presumir que todo macOS 13 usa o mesmo mecanismo de áudio de 14.2+. |
| Lume desktop / Linux | Flag de loopback PulseAudio ativada | Separar PulseAudio, PipeWire com compatibilidade Pulse e PipeWire/portal em X11/Wayland. Investigar captura apenas do aplicativo ou roteamento que exclua o Lume. Se não houver isolamento, manter captura sem áudio global. |
| APK Android | Tela via MediaProjection/SDK; sem configuração explícita de áudio interno no app | Primeiro confirmar se há faixa de áudio de tela e o que ela contém. Manter o estado atual sem prometer áudio interno. Se implementado: Android 10+ com AudioPlaybackCapture, excluir UID do Lume e não incluir voz da chamada; testar o som vindo do WebView principal. Android 8/9 requerem modo sem áudio interno nesse caminho. |
| Navegadores/PWA em Android e iOS/iPadOS | Capacidade depende do navegador; o produto já verifica presença da captura | Manter assistir/chamar. Só oferecer transmissão quando a API estiver disponível. Não anunciar compartilhamento de sistema com áudio como disponível universalmente. |
| Futuro app nativo iOS | Não existe projeto iOS neste checkout | Escopo futuro separado. Exige prova de ReplayKit, distinção entre áudio de app e microfone e validação da exclusão de voz da chamada antes de prometer o recurso. |

Referências para as provas técnicas nativas:

- [Microsoft: Application Loopback](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/ApplicationLoopback/README.md): exemplo de inclusão/exclusão de árvore de processos; requer build compatível. Isso é uma possibilidade de implementação, ainda não presente no Lume.
- [Electron: desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer): diferenças do backend por sistema; no macOS recente uma faixa pode existir, mas estar encerrada por falta de permissão. Existência da faixa não comprova áudio funcional.
- [Apple: excludesCurrentProcessAudio](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/excludescurrentprocessaudio): opção de exclusão em ScreenCaptureKit. Não pressupõe que o caminho Electron/CoreAudio Tap use essa opção diretamente.
- [Android: captura de reprodução](https://developer.android.com/media/platform/av-capture): permite restringir usos e excluir UID. O UID do capturador precisa ser excluído, inclusive quando o áudio da chamada sai do WebView no mesmo app.
- [Apple: ReplayKit](https://developer.apple.com/documentation/replaykit): base para investigar um eventual cliente iOS; não é recurso já implementado neste projeto.

## Testes de aprovação

### Automatizados

- Política de áudio cobre suporte declarado, suporte ausente, configurações verdadeiras/falsas/ausentes e fontes desconhecidas.
- Nenhuma faixa de áudio insegura é publicada enquanto aguarda validação. Vídeo continua funcionando quando o usuário aceita modo sem áudio.
- Falha no áudio não publica microfone como faixa de tela, nem interrompe a chamada.
- Cancelamento, finalização, troca de fonte, reconexão e corrida de pedidos liberam as faixas corretas.
- Conversão real do SDK ou chamada direta preserva as opções escolhidas; mocks de `setScreenShareEnabled` sozinhos não bastam.
- Regressões do receptor: não tocar o participante local, não duplicar reprodução, manter mudo/volume/deafen, não silenciar transmissão quando alguém fala e não duplicar o participante auxiliar Android.

### Funcionais, com captura real

Mínimo: A transmite, B fala e assiste, C também fala e assiste. Microfone de A sem publicação e fones para separar retorno digital de eco acústico. Em seguida, repetir com microfone e alto-falantes como caso independente de cancelamento acústico.

Para cada combinação suportada de plataforma/fonte:

1. Apenas B fala: B e C não recebem uma segunda cópia pelo áudio da transmissão.
2. B e C falam juntos enquanto um jogo/vídeo de teste toca em A: o som do conteúdo continua, sem cortes guiados por fala e sem retorno das vozes.
3. Validar fonte mono/estéreo conforme capacidade; não remover o conteúdo desejado junto com a chamada.
4. Repetir com tela, janela de aplicativo externo, janela do navegador e guia externa. Validar também a tentativa de selecionar o próprio Lume.
5. Trocar dispositivo de saída, trocar fonte, parar pela interface do sistema, reconectar e iniciar novamente.
6. Testar dois transmissores assistindo às transmissões um do outro, incluindo som remoto de outras telas no barramento do Lume.
7. Validar emissor novo com receptor antigo e o inverso. Um receptor novo não consegue remover com segurança uma voz já misturada pela captura antiga.
8. Quando o modo não tiver isolamento, o resultado esperado é vídeo/chamada funcionando e explicação clara de ausência de áudio de sistema — não uma transmissão com eco.

Para medição objetiva, usar sinais diferentes para B, C e conteúdo. Medir a faixa de tela de A separadamente dos microfones, compensando atraso. Meta inicial proposta: componente de B/C pelo menos 45 dB abaixo do sinal de referência, conteúdo preservado e nenhum retorno audível no ensaio. Esse limiar deve ser calibrado no protótipo; não é um resultado já obtido. Não armazenar conversas de usuários para esse teste.

## Sequência de entrega e versões

1. Reproduzir Brave/Windows 11 e registrar metadados reais. Identificar o gatilho antes de escolher mudança de engine ou roteamento.
2. Implementar inspeção antes da publicação, política comum, fallback e cobertura automatizada. Disponibilizar em preview para a matriz prioritária.
3. Validar browser/PWA e instaladores de desktop separadamente. Mudança no web client pode chegar ao desktop que carrega o site, mas não atualiza o Electron empacotado.
4. Distribuir correção web e, quando necessário, novos instaladores Windows/macOS/Linux e APK. Não reutilizar o número da versão anterior para um binário diferente.
5. Limitar recursos por capacidade verificada em clientes antigos; orientar atualização quando o runtime nativo for necessário. Não prometer retroatividade a todos os binários históricos.
6. Publicar matriz de combinações validadas e limites reais. Sistemas não testados continuam classificados como não validados.
7. Verificar em produção e acompanhar somente diagnósticos técnicos sem conteúdo de áudio. Se houver regressão, desabilitar áudio global no caminho afetado mantendo guia isolada, vídeo e chamada quando disponíveis.

## Próximo passo concreto

Executar a reprodução A/B no Brave/Windows 11, com o microfone de A fora da transmissão, áudio de sistema versus guia e inspeção das configurações retornadas. Isso decide se a primeira correção deve priorizar aplicação da restrição, compatibilidade do caminho Web Audio ou indisponibilidade real do isolamento. A inspeção anterior já justifica corrigir o fluxo que publica antes de verificar.
