# Lume Studio — reformulação visual

## O que muda

- Comunidades passam da coluna vertical de ícones para abas com nomes no topo.
- Uma única barra lateral contextual reúne canais ou conversas.
- A página inicial ganha nova composição, filtros horizontais e cartões de conversa.
- Grafite, branco quente e cítrico substituem a identidade azul/órbita.
- Conversas, chamadas, perfis, janelas e autenticação compartilham os novos estilos.
- Controles de chamada ficam visíveis, sem depender de passar o mouse.
- Navegação móvel recebe botões com rótulos e destaque da página atual.
- Atualizador, recuperação e seleção de servidor recebem a mesma identidade.
- A logo original foi preservada. Não houve mudanças no servidor, banco ou autenticação.

## Arquivos centrais

- packages/web/src/styles/studio.css: aparência compartilhada.
- packages/web/src/components/layout/AppLayout.tsx: estrutura principal.
- packages/web/src/components/layout/SpaceSidebar.tsx: comunidades no topo.
- packages/web/src/components/chat/FriendsPage.tsx: página inicial.
- packages/desktop/resources/studio.css: telas nativas do aplicativo.

## Backup e retorno

Esta cópia de trabalho foi criada a partir do commit
514aaef5d7818bd7694f3c29d74359ab37fd0ea0.
A referência local backup/before-lume-studio-2026-09-06 preserva esse ponto.

O backup completo do histórico está no repositório original, em
deploy/backup-before-lume-redesign-2026-09-06.bundle.
O repositório original e seus arquivos de demonstração não foram alterados
por esta reformulação. A cópia independente fica em lume-redesign.

Atenção: esse ponto do código corresponde à beta 14/Órbita. O site estava
usando a interface clássica restaurada separadamente. O backup de código
não deve ser confundido com uma cópia do site clássico em produção.
Antes de qualquer implantação, preservar também o web-dist ativo do servidor.

## Estado de entrega

Implementação local. Não publicada nem implantada.
A checagem TypeScript passou. A geração do pacote Vite foi bloqueada pelo
ambiente Windows ao tentar ler um diretório ancestral (acesso negado),
antes de compilar o aplicativo. A interface ainda requer conferência no
navegador antes da implantação; não considerar essa conferência concluída.
