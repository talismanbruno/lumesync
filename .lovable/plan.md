# Plano de Implementação - Fase 6: Mini Profile Card & Lume Nitro Grátis

Este plano implementa o sistema de perfis aprimorados, permitindo GIFs no banner/avatar, edição de bio e o Mini Profile Card no estilo Discord.

## Alterações de Banco de Dados

1. **Atualizar tabela `profiles`**:
   - Adicionar coluna `banner_url` (text) para suporte a GIFs/imagens de fundo.
   - Adicionar coluna `bio` (text) com valor padrão vazio.

## Componentes e Interface

1. **Mini Profile Card (`src/components/ui/UserProfileCard.tsx`)**:
   - Criar um componente de popover/card elegante.
   - **Topo**: Banner de 100px com suporte a imagem ou gradiente padrão.
   - **Meio**: Avatar sobreposto com badge de status em tempo real.
   - **Conteúdo**: Nome de exibição, @username e seção "Sobre Mim" com a bio.
   - **Rodapé**: Data de entrada ("Membro do Lume desde...").
   - **Ações**: Botão "Enviar Mensagem" (para outros) ou "Editar Perfil" (para o próprio usuário).

2. **Modal de Edição ("Lume Nitro Grátis")**:
   - Criar interface para upload de arquivos (avatar e banner).
   - Permitir edição de `display_name` e `bio`.
   - Implementar persistência no Supabase (Storage + Table Update).

## Correções e Refinamentos

1. **Bloqueio do Bot Lume**:
   - Refinar a verificação do chat ativo para garantir que o Bot Oficial seja sempre bloqueado para escrita.
   - Manter a barra informativa com o cadeado ciano.

2. **Markdown de Mensagens**:
   - Atualizar `src/components/ui/MessageText.tsx` para processar corretamente negritos (`**texto**`) e quebras de linha preservadas.

3. **Integração no Dashboard**:
   - Adicionar triggers de abertura do `UserProfileCard` ao clicar em avatares no chat e listas de membros.

## Detalhes Técnicos
- Utilização de `lucide-react` para ícones.
- `shadcn/ui` (Popover, Dialog, Button) para os componentes de UI.
- Supabase Storage para armazenamento de mídias de perfil.
- Sincronização em tempo real via `profilesCache` já existente.
