# Plano de Implementação: Selo de Administrador Verificado LUME

Padronização do selo de administrador em todas as superfícies da plataforma LUME, utilizando uma fonte de verdade segura (`is_admin`) e um componente centralizado.

## Alterações de Banco de Dados

### 1. Segurança e RLS
*   Verificar a política de RLS da tabela `profiles`.
*   Garantir que apenas a `service_role` (ou triggers `security definer`) possa alterar o campo `is_admin`.
*   Usuários autenticados não devem ter permissão de `UPDATE` no campo `is_admin`.

## Componentes Frontend

### 1. Novo Componente: `AdminVerifiedBadge`
*   **Localização**: `src/components/ui/AdminVerifiedBadge.tsx`
*   **Características**:
    *   Ícone: `ShieldCheck` (ou similar verificado).
    *   Cor: Cyan oficial LUME (`#00D1FF`).
    *   Tooltip: "Administrador verificado do LUME".
    *   Adaptável ao tamanho do texto ao redor.
*   **Lógica**: Recebe um perfil ou booleano `is_admin`.

### 2. Atualização de Superfícies (Integração)
Aplicar o `AdminVerifiedBadge` nos seguintes locais:
*   **Mensagens**: `src/routes/_authenticated.index.tsx` (lista de mensagens e mensagens de grupo).
*   **Cabeçalhos**: Cabeçalho de chat DM e Grupos.
*   **Listas**: Lista de membros do servidor e de grupos, lista de amigos (`FriendsView.tsx`).
*   **Busca**: Resultados de busca de amigos.
*   **Perfil**: Card inferior da sidebar, `UserProfileCard.tsx` e `SettingsModal.tsx`.
*   **Chamadas**: `ActiveCallBar.tsx`, `VoiceRoomUI.tsx` e participantes abaixo da sala de voz.

## Detalhes Técnicos

### 1. Garantia de Dados
*   As queries existentes que buscam perfis já incluem `is_admin` (conforme `types.ts`).
*   Certificar que a `profilesCache` e as funções de busca (como `find_profile_by_username`) retornem o campo.

### 2. Função de Verificação Centralizada
*   Criar uma utilidade `isAdmin(profile)` para evitar verificações manuais espalhadas.

## Restrições
*   Não usar campos não seguros como `username` ou `display_name` para validar admin.
*   O selo do "Bot Oficial" (Lume Bot) deve permanecer distinto e não ser afetado pelo selo de admin humano.
