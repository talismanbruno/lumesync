# Lume Mobile Beta (Android)

Aplicativo Android do Lume com a interface web e integração nativa para chamadas e compartilhamento de tela.

O sistema visual móvel segue o aplicativo web autenticado do Lume: navegação raiz por Servidores, Conversas e Você, telas empilhadas para canais e chats, superfícies quase pretas e seleção em ciano.

- login na conta existente;
- sessão persistente sem armazenar a senha;
- lista de servidores e canais acessíveis;
- leitura e envio de mensagens em canais de texto;
- lista de amigos com presença;
- lista, abertura, leitura e envio de mensagens diretas;
- mensagens e presença atualizadas em tempo real enquanto o aplicativo está ativo;
- notificações Android de novas mensagens;
- envio, aceite e recusa de pedidos de amizade;
- respostas, reações, edição e exclusão de mensagens;
- envio e abertura autenticada de imagens, vídeos, áudios, PDFs e textos (até 25 MB no cliente móvel);
- lista dos canais de voz acessíveis;
- áudio bidirecional pelo LiveKit;
- compartilhamento nativo de tela pelo MediaProjection;
- mistura opcional do áudio reproduzido pelo aparelho (Android 10+; alguns apps bloqueiam a captura).

O aplicativo usa exclusivamente `https://lumesocial.online` e nunca embute senha, token permanente ou segredo do LiveKit. A senha é enviada somente ao endpoint HTTPS de login e não é salva no aparelho.

## Gerar localmente

Abra a pasta `android` no Android Studio e execute o módulo `app`. Para gerar um APK de teste, use a tarefa Gradle `assembleDebug`.

## Gerar no GitHub

A automação `Lume Release` gera o APK junto dos instaladores desktop para tags `v*` ou execução manual. As versões do Android, desktop e release devem coincidir. Ela executa os testes Android, verifica a versão e assinatura do APK e reúne os arquivos em um rascunho completo antes da publicação. A automação `Lume Android APK` permanece disponível para testes Android isolados.

O APK inicial é assinado com a chave de desenvolvimento do Android. Ele é adequado para instalação direta e testes; uma publicação na Play Store deverá usar uma chave de produção guardada como segredo.

Cada runner pode usar uma chave de desenvolvimento diferente. Se o Android rejeitar a atualização por incompatibilidade de assinatura, é necessário remover a versão de teste anterior e instalar a nova, entrando na conta novamente. Nunca publicar a chave privada como artefato. `versionCode` deve aumentar em cada atualização; a beta 20 usa `20`.
