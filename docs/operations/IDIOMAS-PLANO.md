# Idiomas do Lume — levantamento e próxima etapa

Pedido da página “Improvements” do Notion: interface inteiramente em português ou inglês, escolhida pelo idioma do dispositivo. A troca automática ainda não está ativa; este documento prepara a implementação.

## Estado: pausado a pedido do usuário

A migração foi iniciada e pausada em 06/10/2026. Foram preparados 1.583 pares de textos em `packages/web/src/i18n/messages.ts`, um resolvedor de idioma e chamadas explícitas ao catálogo em 133 arquivos. O TypeScript web passou após a primeira migração. A cobertura ainda é incompleta: faltam textos auxiliares, erros, formatação, menus e páginas nativas, além da revisão e dos testes em ambos os idiomas.

`translationsEnabled` permanece `false` em `packages/web/src/i18n/index.ts`. As chamadas preservam os textos originais e seus parâmetros; a seleção automática não foi ativada. Não tratar a tradução como concluída nem reativar essa opção antes de terminar a revisão. Nada foi enviado ao GitHub ou publicado na Oracle.

## Dimensão identificada

O levantamento estático inicial encontrou 1.668 ocorrências em 131 arquivos, com 1.212 textos literais distintos, em `packages/web/src` e `packages/desktop/src`. Esses números são um mínimo: incluem candidatos que precisam de revisão e não capturam todos os textos em expressões condicionais, helpers, erros retornados pela API ou HTML de recuperação.

O inventário detalhado, com arquivo e linha, está em `.deploy-local/organizacao/inventario-idiomas.json`; pode ser regenerado com `.deploy-local/organizacao/inventariar-idiomas.cjs`. A maior concentração aparece nos painéis administrativos de registro, federação, usuários, armazenamento e transmissão, e em instâncias conectadas, conta e pessoas.

## Sequência de implementação

1. Criar um catálogo com chaves comuns e obrigatórias para português brasileiro e inglês. Variantes de português usam o catálogo brasileiro; variantes de inglês usam o inglês. Outros idiomas usam inglês. Definir uma regra única para a lista de preferências do dispositivo e verificá-la no navegador, Electron e Android.
2. Migrar navegação, autenticação, recuperação de conta, pessoas, comunidades, canais, mensagens e avisos. Preservar o texto que vem de usuários: nomes, conversas, descrições, nomes de arquivos e dispositivos.
3. Migrar configurações pessoais e administrativas, chamadas, compartilhamento, permissões, diálogos, mensagens de erro e recursos de acessibilidade. Incluir menus e mensagens nativas do desktop e telas de recuperação. Revisar as mensagens da API que chegam diretamente à interface.
4. Usar o idioma escolhido também nas datas, horários, números e textos com contagem. Atualizar componentes de forma reativa para que menus, diálogos e avisos usem o mesmo catálogo.
5. Conferir chaves e parâmetros dos dois catálogos, preferência automática e formatação. Percorrer os fluxos completos em português e inglês, incluindo interface móvel, configurações administrativas e erros, antes de ativar a seleção automática.

## Critérios para concluir

- Nenhuma chave ausente ou texto de interface sem revisão nas áreas migradas.
- Interface e acessibilidade usam o mesmo idioma, inclusive mensagens de erro e diálogos.
- Conteúdo dos usuários e rótulos fornecidos pelo sistema permanecem intactos.
- Os fluxos funcionam em ambos os idiomas, sem depender do texto traduzido para suas regras internas.
- A ativação automática acontece depois da migração integral e da revisão dos candidatos restantes.

A identidade visual mais própria do Lume fica em uma etapa separada da tradução.
