# Redes sociais e música no perfil

Configurações → Conexões permite adicionar links públicos do X, Spotify, Steam,
Instagram, YouTube, Twitch, GitHub, TikTok, Bluesky e site pessoal. A Epic Games
aparece como nome de exibição, pois não há um endereço universal de perfil
público. Estes dados são informados pela pessoa, sem selo de verificação.

Os links funcionam sem cadastrar um aplicativo em terceiros. Exibir a música
atual exige autorização individual no Spotify e a configuração abaixo.

## Ativar o Spotify na instância

1. Criar um aplicativo em https://developer.spotify.com/dashboard usando uma conta
   elegível. Escolher Web API.
2. Cadastrar exatamente este Redirect URI para produção:
   https://lumesocial.online/app/connections/spotify/callback
3. Configurar SPOTIFY_CLIENT_ID com o Client ID público do aplicativo e
   SPOTIFY_PUBLIC_URL=https://lumesocial.online no ambiente do servidor.
   O fluxo usa PKCE S256; não precisa de Client Secret.
4. Reiniciar somente o serviço Lume. Conectar uma conta de teste em
   Configurações → Conexões. No desktop a autorização abre no navegador do
   sistema; concluir usando a mesma conta Lume que iniciou a conexão.
5. Validar música tocando, troca de faixa, pausa, desconexão, modo invisível e
   Exibir atividades desativado. O aplicativo não reproduz nem controla músicas.

Aplicativos novos ficam em development mode. Pelas regras atuais, o proprietário
precisa de Spotify Premium e há limite de cinco usuários autenticados, adicionados
à lista de usuários autorizados. Disponibilizar para todos depende da elegibilidade
e aprovação de extended quota; configurar o Client ID não remove esse limite.
Documentação oficial:
https://developer.spotify.com/documentation/web-api/concepts/quota-modes

Sem configuração, o servidor informa available=false e a interface explica que a
conexão automática ainda não está disponível. O link público continua funcionando.

## Comportamento e privacidade

O servidor consulta a faixa atual a cada 15 segundos para contas online com
compartilhamento autorizado. A música aparece abaixo do nome no perfil, popout,
menu do próprio perfil, contatos, membros e conversas diretas, incluindo interfaces
móveis. Ela fica fora das listas de participantes e telas de chamada. Pausa ou
ausência de reprodução limpa o status na consulta seguinte; há expiração local
para impedir que uma faixa antiga permaneça caso a conexão caia.

Desconectar revoga o acesso local imediatamente, inclusive autorizações pendentes.
Para revogar também no provedor, a pessoa pode remover o Lume nos aplicativos
autorizados da conta Spotify. Troca de senha do Lume invalida a conexão. Atividades
ocultas e modo invisível impedem a consulta/publicação. Erros limpam a música, e
respostas 429 respeitam Retry-After. Jogos e outras atividades são preservados.

Tokens e verificadores PKCE são cifrados com AES-256-GCM e chave derivada, com
separação de domínio, de JWT_SECRET. Rotacionar esse segredo exige reconectar.
Somente estados aleatórios com hash persistido e duração de dez minutos podem
concluir o fluxo, uma vez, vinculados à mesma conta e época de senha. Tokens
nunca entram nos perfis, na federação, no navegador ou nas URLs. A federação
recebe somente a atividade pública autorizada, sujeita à mesma expiração.
