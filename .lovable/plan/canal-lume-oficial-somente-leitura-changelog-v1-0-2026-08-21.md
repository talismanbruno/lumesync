# Canal Lume [OFICIAL]: somente leitura + Changelog v1.0

## 1. Rodapé somente leitura no chat do bot
Na área de chat (`src/routes/_authenticated.index.tsx`), quando a conversa ativa for com o bot oficial (`id === '00000000-0000-0000-0000-000000000001'` ou `username === 'lume'`):

- Não renderizar o campo de digitação, o botão de anexo, GIFs, emojis nem o botão de enviar.
- No lugar, exibir a barra fixa informativa com ícone de cadeado ciano e o texto: "Este é um canal oficial de transmissão somente leitura. Apenas a equipe do Lume publica novidades aqui."
- Bloquear também os atalhos (Enter, colar arquivo com Ctrl+V) nesse chat, para não haver caminho alternativo de envio.
- Em qualquer outra DM ou canal de servidor, o compositor continua exatamente como está hoje.

## 2. Mensagem oficial v1.0 e função de broadcast (banco de dados)
Duas etapas no backend:

- **Migração**: criar a função `broadcast_system_update(update_text)` (SECURITY DEFINER, `search_path` fixo em `public`) que insere uma mensagem do bot para todos os perfis, exceto o próprio bot. A execução será restrita a administradores/serviço, para que um usuário comum não consiga disparar avisos falsos em massa.
- **Inserção de dados**: enviar a mensagem de Changelog v1.0 (texto exato fornecido, com emojis e negrito em markdown) para todas as contas existentes, marcada como não lida.

Observação: quem se cadastrar depois continuará recebendo a mensagem de boas-vindas já existente; o changelog v1.0 vale para as contas atuais.

## 3. Formatação markdown nas mensagens
Substituir a renderização de texto puro por um renderizador leve que suporte:

- **negrito** com `**texto**`
- quebras de linha preservadas
- emojis (já nativos)

Implementação simples e segura: parser próprio que quebra o texto em linhas e segmentos de negrito, sem `dangerouslySetInnerHTML` (evita injeção de HTML por usuários). Aplicado a mensagens de DM e de canais.

## Validação
- Abrir o chat Lume [OFICIAL]: o aviso v1.0 aparece formatado (títulos em negrito, tópicos, emojis) e o rodapé mostra a barra de cadeado.
- Abrir uma DM comum: envio de texto, anexos, GIFs e emojis funcionando normalmente.
