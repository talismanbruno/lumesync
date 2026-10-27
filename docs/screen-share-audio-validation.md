# Validação de retorno de áudio — Beta 25

## Brecha corrigida

Uma saída com `deviceId=default` ou `communications` é um alias, mesmo quando
o nome exibido parece ser um fone físico. O sistema operacional pode mudar o
endpoint desse alias para um mixer que reproduz o áudio em outro processo.
A exclusão do processo do Lume não exclui esse outro processo.

Na captura de tela/janela com áudio, a proteção agora exige saída específica,
com nome disponível e fora da lista de mixers conhecidos, tanto na preferência
quanto no `AudioContext.sinkId`. Os dois IDs precisam coincidir. A saída é
conferida antes da publicação e durante a captura; perder o dispositivo, mudar
para um alias ou discordar da rota real invalida o áudio de tela. Uma guia
separada mantém sua captura isolada. Nenhuma mudança usa detecção de fala para
silenciar o conteúdo.

## Teste local de 27/10/2026

Teste em processos Electron isolados, sem microfone, gravação de conversas ou
envio de amostras. O guard de produção foi empacotado com adaptadores de teste
para o seletor e a store; o `AudioContext`, a saída e `getDisplayMedia` eram
reais. Um processo produziu o tom de conteúdo em 659 Hz; o processo capturador
reproduziu simultaneamente um tom em 1999 Hz para representar áudio da chamada.

- Electron 43.4.0; Windows reportado por `os.release()`: 10.0.26300.
- Tom do capturador sem exclusão: -47,65 dB no analisador.
- Tom do capturador com exclusão e saída identificada: -107,35 dB.
- Redução do tom próprio: 59,70 dB.
- Tom externo: -54,52 dB antes e durante o tom próprio, sem redução medida.
- Solicitar retorno ao alias padrão acionou a proteção sincronamente antes da
  troca efetiva da saída.

Valores são magnitudes espectrais do mesmo analisador, não nível acústico nem
medição calibrada. Testes automatizados cobrem alias com nome físico, rejeição
de escolha obsoleta, desconexão e divergência entre preferência e saída real.

## Limites

Não é uma prova de correção universal. Este teste não é uma chamada real,
não reproduz todos os drivers/mixers e não valida macOS/Linux/Android ou Brave
em todas as versões. Nomes de dispositivos não certificam hardware. Plataformas
que não confirmam exclusão continuam sem transmitir áudio do sistema, com aviso.
A troca de saída permanece uma escolha explícita do usuário quando necessária.

Referências técnicas:

- https://releases.electronjs.org/pr/52455
- https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/ApplicationLoopback/README.md
