# Plano de Refinamento de UI e Sistema de Movimento LUME

Refinar a interface das listas de amigos para maior responsividade e estética, e implementar um sistema de microanimações consistente em todo o aplicativo.

## ETAPA 1: Refinamento das Listas de Amigos

### Mudanças Estruturais
- Criar o componente `FriendRow` em `src/components/ui/FriendRow.tsx` para padronizar a exibição de amigos.
- Envolver as listas de amigos em `FriendsView.tsx` em um container responsivo:
  - Desktop: `max-w-5xl` (aproximadamente 1024px), alinhado conforme o layout.
  - Mobile/Tablet: `w-full`.
- Padronizar a altura das linhas (64px a 72px) e tamanho dos avatares (40px a 44px).

### Estilo Visual
- Fundo carvão discreto com borda fina (`border-white/5`).
- Hover refinado: fundo levemente mais claro e borda ciano de baixa opacidade.
- Truncamento correto para nomes longos e preservação de selos administrativos.
- Botões de ação alinhados à direita com estados de hover/focus claros.

## ETAPA 2: Sistema de Movimento LUME

### Definições de Design (Tokens CSS)
- Adicionar variáveis de animação em `src/styles.css`:
  - `duration-fast`: 150ms (interações rápidas).
  - `duration-normal`: 200ms (hover/seleção).
  - `duration-slow`: 260ms (painéis/modais).
  - `easing-lume`: `cubic-bezier(0.22, 1, 0.36, 1)`.

### Implementações de Microanimações
- **Botões:** Transição de cor suave e `scale(0.98)` ao pressionar.
- **Cards e Listas:** `translateY(-1px)` no hover e animação de entrada com fade/slide sutil (staggered).
- **Abas:** Transição fluida do indicador ativo e fade no conteúdo.
- **Modais e Popovers:** Entrada com `opacity` e `scale(0.98 -> 1)`.
- **Sidebar:** Feedback visual suave na seleção de itens.
- **Mensagens:** Entrada sutil apenas para novas mensagens em tempo real.

### Acessibilidade e Performance
- Respeitar a preferência `prefers-reduced-motion` do sistema.
- Evitar animações de propriedades custosas como `width`, `height` e `filter` em containers grandes.

## Detalhes Técnicos
- Uso exclusivo de Tailwind CSS e CSS nativo.
- Preservação total da lógica de negócio (Supabase, WebRTC, Auth).
- Atualização dos arquivos:
  - `src/styles.css`
  - `src/components/ui/FriendsView.tsx`
  - `src/components/ui/FriendRow.tsx` (novo)
  - `src/components/ui/button.tsx`
  - `src/components/ui/dialog.tsx`
  - `src/components/ui/popover.tsx`
  - `src/components/ui/context-menu.tsx`
  - `src/routes/_authenticated.index.tsx`
  - `src/components/ui/FriendActionButtons.tsx`
