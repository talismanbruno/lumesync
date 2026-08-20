# Plano de Correção: Loop de Performance e Estabilidade do Auth

## 1. Correção do Loop Infinito e Performance
- **Diagnóstico**: O loop infinito ocorre no `RootComponent` em `src/routes/__root.tsx` porque o `useEffect` tem `[router]` como dependência e chama `router.navigate` ou `router.invalidate`, disparando a si mesmo.
- **Solução**: Isolar o listener do Supabase, garantir array de dependências vazio `[]` onde apropriado e adicionar proteção de montagem (`mounted` flag) e cleanup (`subscription.unsubscribe`).

## 2. Refatoração do Formulário de Auth
- **Mudança**: Isolar a lógica de login e cadastro em um componente `<form>` com `onSubmit` e `e.preventDefault()`.
- **Validação**: Impedir cliques múltiplos durante o loading e tratar erros com toasts em português.

## 3. Estabilidade do Dashboard
- **Melhoria**: Garantir que `src/routes/_authenticated.index.tsx` não tenha loops de re-renderização ao buscar mensagens em realtime.
- **Redirecionamento**: Corrigir `src/routes/index.tsx` para usar o path correto ou ser removido se conflitar com o router tree.

## Detalhes Técnicos
- Utilizar `supabase.auth.onAuthStateChange` com cleanup no `useEffect`.
- Substituir navegação direta no corpo do componente por lógica dentro de `useEffect` ou handlers.
- Atualizar a logo do LUME no formulário de auth conforme solicitado.
