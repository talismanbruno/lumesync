# Entrada no aplicativo com a sessão do navegador

## Experiência

Quando um app desktop sem sessão abre a tela de entrada pela primeira vez naquela janela, ele abre a confirmação no navegador padrão do sistema. Se a pessoa já está conectada à mesma instância naquele navegador, só confirma **Continuar como @usuário** e permite abrir o Lume. Não digita novamente usuário e senha.

A tela do app prioriza esse caminho. **Entrar com usuário e senha** abre o formulário habitual; cancelamento e falhas deixam essa alternativa disponível. O navegador não recebe uma aprovação automática só por visitar a página. Se não estiver conectado, o login web preserva o pedido de retorno.

Não há leitura de cookies, bancos de dados, arquivos ou perfis dos navegadores. O navegador padrão pode ser diferente daquele em que a pessoa está conectada; nesse caso ela pode abrir a confirmação no navegador correto ou entrar normalmente. Depois de autenticado, o app mantém sua própria sessão pelo mecanismo existente do Lume.

## Caminho técnico

1. O cliente desktop gera, com Web Crypto, `state` aleatório e uma prova PKCE S256. A prova privada fica somente em memória; o pedido vale por cinco minutos.
2. Abre `/app/desktop-login#challenge=...&state=...` na mesma origem. O fragmento não contém JWT ou prova privada e não é enviado em solicitações HTTP da navegação.
3. A página confirma a sessão atual. Uma sessão ausente ou expirada encaminha para o login, preservando o pedido. A aprovação exige clique explícito e autenticação Bearer.
4. `POST /api/auth/desktop/authorize` emite um código aleatório, válido por 60 segundos e ligado à prova, ao usuário e ao estado de revogação da senha. O servidor guarda somente o hash do código.
5. O navegador abre o protocolo já registrado `lume://auth/callback?code=...&state=...`. Não envia o JWT do navegador, senha ou prova privada ao protocolo do sistema.
6. O app aceita apenas um callback correspondente ao pedido ativo e dentro da validade. Envia código e prova privada para `POST /api/auth/desktop/exchange` na instância original.
7. O servidor verifica PKCE, consome o código uma única vez, revalida existência, suspensão, exclusão e alteração de senha, e retorna a resposta de sessão normal do Lume. O cliente usa `initSession` e abre a conversa.

A abertura em navegador externo e o vínculo por PKCE seguem os princípios de [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) e [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636). Este recurso é uma passagem de sessão interna do Lume, não um serviço OAuth completo. O protocolo `lume:` existente foi preservado por compatibilidade; interceptar um código de retorno não basta sem a prova privada.

## Limites e proteção

- Respostas que contêm código ou sessão usam `Cache-Control: no-store`; o protocolo externo nunca contém a sessão completa.
- A aprovação tem limite de tentativas e o armazenamento temporário é limitado a 2.000 códigos por processo. Códigos expirados são removidos sob demanda e o fechamento do servidor limpa os pedidos.
- Um reinício invalida as autorizações pendentes. Um ambiente com múltiplas réplicas precisa de armazenamento temporário compartilhado ou roteamento consistente; a implantação atual usa um processo de aplicação.
- Códigos não são persistidos em banco nem reutilizados. Uma troca simultânea só pode ter um vencedor. Tentativas sem a prova correta não consomem a autorização legítima.
- Callback sem pedido ativo, com estado divergente, campos duplicados, rota/protocolo incorretos ou prazo vencido é ignorado. Um login manual que termina durante a troca não pode ser substituído pela autorização atrasada.
- O app abre o navegador automaticamente uma única vez por janela. Logout ou mudança de formulário não fica abrindo novas abas repetidamente.
- O navegador pode pedir permissão para abrir o aplicativo. O botão **Abrir Lume** permite repetir essa abertura sem emitir outra autorização.
- A sessão continua usando o JWT e as regras de duração/revogação já existentes. Não é uma implementação nova de gerenciamento de sessões por dispositivo.
- O app desktop atual já possui protocolo e ponte de deep links. Não há mudança no binário Electron, banco, formato de sessão ou credenciais salvas. O recurso não é anunciado como login automático do APK Android.

## Validação

- Servidor: sessão obrigatória, desafio inválido, código sem JWT, troca correta, prova errada, replay, concorrência, expiração, senha alterada, conta suspensa/excluída e isolamento entre instâncias/processos.
- Cliente: prova S256, ausência de segredo na URL, vínculo do callback, cancelamento, limpeza de listeners, retorno atrasado, erro/expiração e abertura única sob React StrictMode.
- Confirmação web: nunca aprova ao carregar/visualizar o link; mantém a conta visível; envia somente código e estado ao app; preserva o pedido pelo login; rejeita campos duplicados.
- Login e recuperação existentes continuam cobertos pelos testes de regressão. A revisão visual local usa somente a conta fictícia `@lume_demo`; não autoriza nem altera uma conta de produção.
- Na validação instalada: abrir o desktop deslogado com navegador já conectado; confirmar a conta; aceitar a abertura do Lume; verificar entrada e persistência após reabrir. Repetir com navegador deslogado, navegador padrão diferente e cancelamento. O salto real pelo protocolo do sistema deve ser validado nos instaladores Windows, macOS e Linux; testes de componentes não substituem essa checagem.
