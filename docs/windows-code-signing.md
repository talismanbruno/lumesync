# Assinatura dos instaladores Windows

## Diagnóstico em 27/10/2026

O instalador público `Lume-1.0.0-beta.24-x64.exe` verificado localmente retorna
`NotSigned` em `Get-AuthenticodeSignature`. Os processos de release não recebiam
credenciais de assinatura. A mensagem “O Windows protegeu o computador” é
compatível com o SmartScreen bloqueando um aplicativo desconhecido; não é, por
si só, um diagnóstico de malware. Uma detecção com nome de ameaça no Defender
precisa ser investigada separadamente, com o arquivo e seu hash.

## Integração preparada

Os workflows `Lume Release` e `Lume Desktop Release` aceitam os segredos
`WIN_CSC_LINK` (certificado PFX compatível com electron-builder, normalmente em
base64) e `WIN_CSC_KEY_PASSWORD`. Nunca colocar certificado privado, senha ou
token no repositório, em artefatos ou em mensagens. Credenciais só são entregues
ao empacotamento Windows. Não é necessário ativar descoberta de certificados do
runner para usar um certificado explícito.

O empacotador usa SHA-256 e seu serviço de timestamp. A verificação executa
`scripts/verify-windows-signatures.ps1` no instalador e no `Lume.exe` empacotado,
incluindo as duas arquiteturas quando presentes. Com credenciais configuradas,
assinatura ausente, inválida ou sem timestamp faz o job falhar antes de subir
artefatos. Sem credenciais, as betas continuam identificadas explicitamente
como não assinadas no resumo do build. Isso não resolve o alerta por si só.

Não assinar o instalador depois de gerar os manifests de atualização: isso
mudaria os bytes e invalidaria seus hashes. A assinatura precisa ocorrer no
empacotamento, antes dos manifests e checksums.

## Pendência externa

É necessário obter um certificado de assinatura de código emitido por uma
autoridade confiável, ou integrar um serviço de assinatura em nuvem com a mesma
identidade do editor. Não há certificado de produção incluído neste projeto.
Certificados novos normalmente exigem HSM/token ou assinatura em nuvem; o
formato PFX desta integração só serve se o emissor permitir esse uso. Não usar
um certificado autoassinado para tentar ganhar reputação pública.

Para este projeto aberto, vale avaliar o programa gratuito da SignPath
Foundation, sujeito a elegibilidade, revisão do projeto, condições e aprovação
das releases. A integração específica do serviço depende de adesão aprovada;
ela não está ativada. Não comprar EV apenas para tentar remover SmartScreen:
a Microsoft informa que EV já não tem liberação imediata.

Assinatura válida permite verificar o editor e acumular reputação; não garante
ausência de aviso nas primeiras instalações. Distribuição pela Microsoft Store
é outra via, com cadastro e revisão próprios. Não orientar usuários a desligar
o SmartScreen nem alterar configurações de segurança como “correção”.

Fontes:

- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://signpath.org/terms
- https://www.electron.build/code-signing.html
