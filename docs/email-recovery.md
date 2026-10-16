# Recuperação por e-mail

O cadastro aceita um endereço privado e opcional. Contas atuais podem adicioná-lo em **Configurações → Minha conta → E-mail de recuperação**, informando a senha atual. O endereço só recupera a conta depois de confirmado. Alterar o endereço mantém o anterior válido até confirmar o novo.

O login usa **Esqueci minha senha** e um link com validade de 15 minutos. O link funciona uma única vez. Ao trocar a senha, os links anteriores, os códigos de emergência anteriores e as sessões antigas são invalidados. Uma conta sem endereço confirmado não pode ser recuperada por e-mail retroativamente.

## Envio real

1. Criar uma conta no Resend e verificar um domínio remetente por DNS.
2. Definir `RESEND_API_KEY` e `MAIL_FROM` no servidor. Nunca colocar a chave no frontend.
3. Definir `AUTH_EMAIL_PUBLIC_URL` como a origem HTTPS do aplicativo web. O padrão é `PUBLIC_ORIGIN` ou `https://DOMAIN`.
4. Reiniciar o servidor e testar com uma conta de teste antes de disponibilizar aos usuários.

Sem configuração, o sistema permite salvar o endereço, mas explica que o envio não está disponível. Não mostra uma confirmação de envio falsa. Se um envio de confirmação falhar, ele pode ser repetido nas configurações.

## Teste local

Definir `AUTH_EMAIL_PUBLIC_URL=http://localhost:5193` e `EMAIL_PREVIEW_DIR` para uma pasta privada de teste fora de qualquer diretório servido pelo site. O servidor escreve arquivos JSON contendo os e-mails de teste. Não há envio externo. Esta opção é ignorada em produção. Excluir esses arquivos após o teste, pois contêm links secretos.

## Proteções

- Endereços ficam em tabela privada, fora do perfil público e da federação.
- Tokens aleatórios de 256 bits; apenas hashes SHA-256 no banco.
- Tokens ficam no fragmento do link, fora dos logs HTTP e cabeçalhos Referer.
- Confirmação e redefinição exigem uma ação POST explícita.
- Limites por IP e intervalo mínimo por conta; a solicitação de recuperação responde igualmente para endereços existentes e desconhecidos.
- Contas suspensas, excluídas e de instâncias remotas não são recuperáveis por este fluxo local.
- Contas remotas continuam gerenciando sua senha e recuperação na instância de origem.
