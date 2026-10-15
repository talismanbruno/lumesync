# Personalização de perfil

O editor fica em **Configurações → Personalização** e nos atalhos **Editar perfil**. Usa os grupos placa, avatar e decoração, estilo do nome, banner, efeitos e molduras, cor do avatar e cores do perfil. Banner oferece dois botões lado a lado: **Enviar banner**, sempre com ícone de envio, e **Bandeiras**, que abre diretamente o seletor de países. A imagem enviada aparece na prévia ao vivo. A interface usa superfícies escuras, bordas suaves e realce ciano do Lume.

A seleção tem duas etapas: **Aplicar** atualiza a prévia; **Salvar alterações** persiste o perfil. Cancelar um seletor descarta sua seleção. Redefinir descarta o rascunho do editor. O estilo do nome pode ser restaurado separadamente. Avatar e banner mantêm os fluxos anteriores de upload, corte de imagens estáticas e preservação de GIFs.

## Biblioteca local

Os binários ficam fora do Git e do pacote JavaScript, em `data/customization/assets`. O servidor publica somente esse diretório em `/api/customization/assets/`, com cache imutável; o catálogo fica em `data/customization/catalog.json`. `CUSTOMIZATION_DIR` permite escolher outra localização. Seu padrão acompanha o diretório de `DB_PATH`.

Para preparar uma instalação com a biblioteca extraída:

```powershell
node scripts/import-customization-library.mjs "C:\caminho\Discord-personalizacao-biblioteca-20261015"
```

O script lê `biblioteca.json`, `recursos.json` e `estilos-de-nome/fontes-css.json`; publica os recursos por hash e gera o catálogo e as regras locais de fontes. No mesmo volume, usa hard links; entre volumes, copia. Uma segunda execução reaproveita os arquivos existentes. O destino opcional é o segundo argumento. Após alterar o catálogo, reinicie o servidor para atualizar seu cache.

A importação de 15/10/2026 contém **1.418 itens**: 693 decorações de avatar, 364 efeitos de perfil, 291 placas e 70 molduras; **5.537 recursos** (aproximadamente 3,02 GB). Fontes, efeitos de nome e cores são configurados separadamente. Os quatro efeitos experimentais do cliente de referência não são apresentados.

No deploy, transfira o diretório de personalização completo para o volume de dados e gere o CSS de fontes antes do build. O snapshot SQLite não contém esses binários. O PWA não os baixa durante a instalação; as imagens são solicitadas conforme a seleção e a navegação.

## Renderização e dados

`ProfileCustomization` é um objeto opcional em `User`, validado no servidor e serializado em `users.customization`. Contém apenas IDs de catálogo, uma fonte e um efeito permitidos, até cinco cores hexadecimais e uma cor principal. URLs e CSS enviados pelo perfil são rejeitados. Cada ID precisa pertencer à categoria correta. Não há compra ou dependência de autenticação do Discord.

`avatarColor` aceita os sete identificadores de paleta existentes ou uma cor hexadecimal de seis dígitos (`#RRGGBB`), validada por `isAvatarColor` no perfil. O seletor **Personalizada** permite escolher qualquer cor; os avatares sem foto usam a cor exata e ajustam o contraste da inicial. O valor continua no mesmo campo do banco e nos snapshots/eventos de perfil, sem migração nem alteração de identidade federada. Cores principal e de realce ficam visíveis abaixo da cor do avatar.

O tema do cartão usa `customization.themeColor` e `customization.themeSecondaryColor`, ambas hexadecimais de seis dígitos. `getProfileThemeStyle` aplica o mesmo degradê vertical na prévia, no menu próprio, no popout, no perfil completo e no cartão mobile. Tonalidades muito claras são escurecidas preservando o matiz para manter texto legível. A segunda cor é independente do banner enviado e da bandeira; `accentColor` continua como cor legada do banner e como fallback para perfis que ainda não escolheram uma segunda cor. Restaurar cores limpa os dois campos e esse fallback. A dupla é persistida e federada no objeto de personalização existente, sem nova coluna no banco.

As decorações usam APNG original, placas usam a mídia original e efeitos reproduzem as camadas com seus tempos de início, duração, repetição e intervalo. Molduras respeitam âncora, ordem e margens do catálogo. As laterais responsivas acompanham a altura real do cartão somada às margens superior e inferior, em vez de manter a altura natural da imagem; assim não invadem os controles abaixo do perfil. A preferência de movimento reduzido usa imagens estáticas nas decorações e placas e desativa as camadas animadas dos efeitos.

Avatares e nomes compartilham os componentes de identidade do Lume. Placas aparecem nas listas de membros e no cabeçalho do perfil. Efeitos e molduras aparecem nas prévias, no popout e no perfil completo. O editor oferece busca, filtro de coleção, carregamento por lotes, foco contido e fechamento por Escape. As decorações de avatar usam diretamente os endereços por hash do catálogo quando disponíveis. GET/HEAD das rotas de mídia estática e redirecionamento de itens não consomem o limite global da API; catálogo, atualização de perfil e demais ações continuam protegidos. Isso permite percorrer a biblioteca sem bloquear imagens ou salvamentos por excesso de requisições de mídia.

O campo opcional acompanha os snapshots de perfil, lookup, attach e eventos `profile_update`. A origem do perfil permanece soberana; pares antigos que omitem o campo preservam a seleção. `null` remove a personalização. Os pares precisam servir o mesmo catálogo para renderizar os IDs compartilhados; um recurso ausente não impede a leitura do perfil.

## Menu do próprio perfil

`SelfProfileMenu` substitui a lista de presença do rodapé por um cartão com banner, avatar decorado, estilo de nome, badges, bio e atividade atual. Editar perfil abre o novo editor; presença e status personalizado continuam usando `updateProfile`. Há acesso ao perfil completo e cópia do ID. Escape fecha o menu e devolve o foco ao acionador; erros de atualização preservam o rascunho.

`ProfileFrameSpace` reserva espaço no layout conforme a largura e as margens externas da moldura. O cartão e a descrição do item não compartilham a área pintada pela arte. Camadas de fundo da moldura ficam atrás do conteúdo; ornamentos frontais mantêm a ordem original.

## Bandeiras no app

O editor oferece **Bandeiras para banner** e **Bandeiras para placa**, com prévia e salvamento no perfil. `/previews/bandeiras.html` continua disponível como demonstração independente. Inclui 249 códigos ISO de países e territórios e mais Inglaterra, Escócia, País de Gales e Kosovo. Os SVGs são da coleção **flag-icons v7.3.2**, MIT, com licença em `public/previews/flags/LICENSE.txt`.

`FlagCloth` é um renderizador original do Lume: distorção de textura, iluminação de dobras e trama de tecido em WebGL, com fallback Canvas 2D. O seletor usa uma grade de calling cards paginada, busca por nome/código e prévia ao lado, seguindo os outros seletores de personalização. As abas alternam banner e placa mantendo a bandeira escolhida; pausa e movimento reduzido são respeitados. No celular, a prévia fica acima da grade. Os arquivos são locais e carregados sob demanda. `node scripts/prepare-flag-preview.mjs` reproduz a importação da versão fixada.

As texturas são rasterizadas a partir dos SVGs em 2048 × 1024, com mipmaps para redução limpa. A prévia usa pelo menos duas amostras por pixel CSS. As miniaturas são PNGs de 768 × 192 gerados pelo mesmo renderizador, em uma fila que compartilha um único contexto; o cache mantém até 48 miniaturas. A iluminação não usa a antiga trama calculada em pixels de tela, que causava pontilhado e moiré.

`bannerFlag` e `nameplateFlag` aceitam apenas os 253 códigos da lista compartilhada. A seleção é persistida e federada no objeto de personalização. Uma bandeira substitui visualmente o banner enviado, preservando o arquivo anterior; remover a bandeira restaura esse arquivo. Escolher uma placa do catálogo remove a bandeira da placa e vice-versa. Um único contexto WebGL atende às superfícies visíveis do app, com cache de texturas e canvases 2D por superfície.

## Novidades da beta 21

O anúncio usa seleções reais da biblioteca: decoração ametista, moldura de cristais, banner de aurora, placas cósmicas e uma bandeira do Brasil em destaque na categoria Banners e bandeiras da vitrine. A apresentação contém apenas texto e imagens WebP fixas em `public/releases/beta21`, capturadas a partir dos componentes reais; não carrega catálogo, animações ou seletores. A vitrine não tem um card separado de molduras do cartão. Explorar personalização abre o editor. O identificador da atualização permite exibir o anúncio mesmo para quem fechou a versão anterior. O botão de reabertura fica por último nas configurações desktop e mobile.
