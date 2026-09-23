# Lume Mobile Beta (Android)

Primeiro módulo nativo do Lume para Android. O escopo é intencionalmente pequeno:

- login na conta existente;
- lista dos canais de voz acessíveis;
- áudio bidirecional pelo LiveKit;
- compartilhamento nativo de tela pelo MediaProjection;
- mistura opcional do áudio reproduzido pelo aparelho (Android 10+; alguns apps bloqueiam a captura).

O aplicativo usa exclusivamente `https://lumesocial.online` e nunca embute senha, token permanente ou segredo do LiveKit. A senha é enviada somente ao endpoint HTTPS de login e não é salva no aparelho.

## Gerar localmente

Abra a pasta `android` no Android Studio e execute o módulo `app`. Para gerar um APK de teste, use a tarefa Gradle `assembleDebug`.

## Gerar no GitHub

Uma tag no formato `android-v*` dispara a automação `Lume Android APK`. Ela executa os testes, compila o APK de teste e o publica em uma versão do GitHub.

O APK inicial é assinado com a chave de desenvolvimento do Android. Ele é adequado para instalação direta e testes; uma publicação na Play Store deverá usar uma chave de produção guardada como segredo.
