# Correção de áudio da transmissão — 08/11/2026

## Estado
Implementada no repositório e empacotada como prévia Windows x64. Ainda não publicada nem instalada sobre o Lume em uso. Precisa de validação com duas pessoas em uma chamada LiveKit real antes de ser considerada aprovada.

## Mudança
Quando o Electron devolve loopback sem exclusão, o Lume tenta um capturador nativo de áudio que exclui a árvore de processos do próprio Lume. Não transmite o loopback inseguro nem usa o microfone para substituir o som do conteúdo.

A ativação nativa funcionou neste Windows 10 Pro, build 19045. Portanto, o diagnóstico anterior deve ser entendido como limitação do caminho do Chromium, não incapacidade absoluta deste Windows: o limite documentado do exemplo Microsoft não substitui o teste efetivo de ativação.

O PCM estéreo passa pelo preload, por um AudioWorklet com fila limitada e por uma faixa separada ScreenShareAudio. Não é reproduzido localmente. A transmissão não depende de alguém estar falando; o microfone mantém seu fluxo próprio.

Cancelamento, parada de vídeo, desconexão, saída nativa inesperada, navegação e encerramento liberam a captura. O renderer não escolhe processo, comando ou executável. Iniciar requer a escolha explícita de uma fonte com áudio no seletor.

## Evidências
- 57 testes web passaram: fonte nativa, publicação, áudio separado, falhas, cancelamento, escolha de saída e cleanup.
- 7 testes desktop passaram: enquadramento, pacotes parciais, isolamento de buffers e limites de memória.
- Verificação TypeScript de desktop e web: passou.
- Build Vite: passou, com avisos de tamanho de chunks e fontes de personalização resolvidas em runtime.
- Build desktop Windows x64: passou; capturador confirmado em app.asar.unpacked/resources/native/LumeProcessAudio.exe.
- Servidor local respondeu HTTP 200 em /api/health; frontend serviu o worklet com HTTP 200. Serviços de teste encerrados depois da verificação.
- Teste de tons nativos em saída física: conteúdo 659 Hz preservado; tom próprio 1999 Hz com razão 0,00352 em relação ao conteúdo.
- Fluxo real da ponte/preload/worklet/faixa até um receptor WebRTC local: conteúdo -61,54 dB e tom próprio -114,97 dB; faixa encerrou ao parar.
- Repetição usando o executável nativo extraído do pacote: conteúdo -61,42 dB e tom próprio -96,62 dB; faixa encerrou ao parar.
- Valores espectrais são métricas do teste, não níveis acústicos calibrados nem garantia universal de ausência de eco.

O teste com rota padrão recapturou o tom próprio. Com saída física específica, a exclusão passou. Por isso a proteção/seleção de saída física permanece obrigatória. Mixers externos podem reemitir som do Lume por outro processo.

## Arquivos centrais
- packages/desktop/native/WindowsProcessAudio.cs
- packages/desktop/src/windowsScreenAudio.ts
- packages/desktop/src/main.ts e preload.ts
- packages/desktop/scripts/build-native.cjs e beforePack.cjs
- packages/web/src/utils/nativeScreenAudio.ts
- packages/web/src/utils/screenShare.ts e screenShareAudioPolicy.ts
- packages/web/public/audio/nativeScreenAudio.worklet.js

## Prévia gerada
packages/desktop/dist-electron/audio-fix-preview/win-unpacked/

A prévia desktop precisa também do frontend atualizado. O aplicativo abre o cliente web do servidor; executar a prévia contra o frontend antigo não ativa o novo caminho. Nenhum arquivo do aplicativo instalado foi substituído e nenhuma alteração foi publicada no servidor.

## Aprovação ainda pendente
Em dois clientes Lume reais, com a versão corrigida:
1. Pessoa A compartilha tela com áudio; pessoa B assiste.
2. Ambas falam durante o conteúdo: as duas vozes e o conteúdo precisam continuar audíveis.
3. B não pode ouvir a própria voz retransmitida pela tela; A não pode ouvir sua voz duplicada.
4. Mutar A afeta só seu microfone; parar a transmissão afeta só a transmissão.
5. Repetir com troca de fonte, saída desconectada e reconexão.
6. Testar fones e alto-falantes separadamente: eco acústico do microfone não é a mesma falha que retorno no áudio de tela.

Os testes locais não substituem essa chamada; não houve aprovação de áudio de duas pessoas nesta etapa.
