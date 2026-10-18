# Personalização original do Lume — proposta de direção

## Objetivo

Manter a liberdade de personalização gratuita e transformar o catálogo em uma coleção reconhecível como Lume: luz, superfícies escuras, reflexos, volume e movimento contido. A referência de qualidade é o acabamento de um cosmético de jogo; a composição e os arquivos devem ser próprios.

## Diagnóstico do código e dos arquivos locais

- O importador atual lê uma biblioteca externa e conserva seus IDs, mídia, camadas, descrições e fontes. Renomear ou recolorir esses arquivos não cria um catálogo original.
- O catálogo local contém 1.418 entradas: 693 decorações de avatar, 364 efeitos, 291 placas de identificação e 70 molduras. Esse é um inventário local, a confirmar com o catálogo do servidor antes da migração.
- O perfil demonstrado na landing também utiliza essa mídia importada. Deve acompanhar a primeira coleção original aprovada.
- Existem componentes reutilizáveis para renderizar molduras, efeitos, banners e nomes. A migração pode manter esses recursos e substituir a arte e a linguagem de movimento.
- Banners e avatares enviados pelos usuários devem continuar funcionando. Bandeiras nacionais podem usar o renderizador de tecido próprio, com textura e iluminação produzidas para o Lume.

## Direção proposta: luz com matéria

O ciano da marca é a assinatura, não uma obrigação para todos os itens. Cada coleção pode ter uma paleta própria, mantendo contraste, profundidade e movimentos relacionados. Sem órbitas, excesso de elementos soltos ou ornamento atravessando o nome, a bio e os botões.

1. **Forma:** contornos integrados ao perfil, espessura coerente, destaque principal bem definido e centro livre.
2. **Material:** vidro escuro, metal acetinado, luz refratada, tecido ou energia com volume. Escolher um material dominante por conjunto.
3. **Luz:** brilho localizado, reflexos com direção e sombras coerentes. O efeito precisa continuar bonito com a animação pausada.
4. **Movimento:** uma entrada curta e um ciclo contínuo discreto, com começo e fim compatíveis. Usar passagem de luz, deformação, refração e pequenas mudanças de intensidade, sem depender de partículas aleatórias.
5. **Hierarquia:** avatar, nome e conteúdo permanecem mais importantes que o cosmético. Miniaturas usam enquadramento específico para o catálogo.

## Primeira entrega para aprovação: seis pilotos do mesmo conjunto

Nome provisório da coleção: **Refração**.

| Item | Proposta original | Critério de avaliação |
| --- | --- | --- |
| Avatar — Filete | Aro de vidro fino com dois reflexos assimétricos que percorrem o contorno | Reconhecível no avatar de 34 px, rosto totalmente visível |
| Avatar — Faceta | Pequenas superfícies translúcidas integradas ao aro, com refração em ciano e violeta | Silhueta diferente do Filete, sem parecer enfeites avulsos |
| Moldura — Prisma escuro | Moldura contínua de vidro fumê com luz concentrada nas quinas | Centro e banner livres, nenhuma sobreposição aos controles |
| Efeito — Passagem | Faixa de luz refratada que atravessa o plano do perfil e desaparece suavemente | Impacto breve e retorno calmo, texto legível durante toda a passagem |
| Placa — Espectro | Superfície escura com reflexo largo e textura discreta | Nome permanece legível com todas as cores permitidas |
| Banner — Lume | Composição horizontal própria com a marca, profundidade e luz integrada ao cenário | Bonito no recorte real e em tela pequena, sem emendas visíveis no ciclo |

Apresentar os seis no catálogo, no perfil compacto e no perfil completo reais. Aprovar esse conjunto antes de produzir mais temas. Halloween pode ser a próxima coleção, com silhuetas de fantasma e chama desenhadas do zero.

## Produção e rastreabilidade

- Criar arquivos-fonte próprios para cada peça: vetores, cenas ou projetos de animação; gerar os arquivos de distribuição a partir deles.
- Registrar autor, origem, versão, formato, dimensões, duração, miniatura e alternativa estática em um manifesto. Documentar também a origem e as permissões das fontes tipográficas.
- Criar regras compartilhadas de enquadramento, brilho, duração e margens seguras para que coleções diferentes pareçam parte do mesmo produto.
- Avaliar o formato pelo resultado e pelo custo: vetores/CSS para formas simples; vídeo, WebP/APNG ou canvas para efeitos que realmente precisem deles. Não escolher um formato pesado só para manter compatibilidade com a biblioteca anterior.

## Migração do catálogo

1. Inventariar famílias e variantes de cor; marcar origem e uso. Separar o material produzido para o Lume do material importado.
2. Aprovar os seis pilotos e medir desempenho em perfis reais.
3. Adicionar identidade própria aos itens e um mapa explícito entre escolhas antigas e novos equivalentes. Validadores compartilhados, API e placa de identificação hoje pressupõem IDs numéricos; qualquer novo esquema de IDs precisa ser implementado em conjunto.
4. Mostrar uma prévia da substituição e permitir escolher outro item ou nenhum. Preservar nome, bio, cores e mídia enviada pelo usuário.
5. Migrar por família, atualizar a landing e as miniaturas e retirar a mídia antiga das novas seleções conforme os equivalentes forem aprovados. Remover os arquivos antigos depois de verificar referências e concluir a transição.

## Critérios para liberar uma coleção

- Perfil legível nos tamanhos reais, com nomes longos e no celular.
- Nenhum botão ou área de texto coberto; camadas decorativas não capturam cliques.
- Mesma aparência entre catálogo, preview, menu e perfil completo.
- Nenhum salto de tamanho ao rolar, pausar, carregar a mídia ou repetir o efeito.
- Movimento reduzido com uma alternativa estática bem acabada.
- Pausa fora da tela e consumo medido com várias pessoas visíveis; registrar tempo de quadro, memória e peso transferido no Mac Apple Silicon, Windows e Android.
- Comparação lado a lado com a biblioteca anterior para rejeitar reproduções de silhueta, composição ou sequência de animação.
- Arquivos-fonte, autoria e manifesto completos antes da publicação.

## Decisão seguinte

Aprovar ou ajustar a direção **Refração**. Depois produzir os seis pilotos; a expansão do catálogo vem após essa validação visual.
