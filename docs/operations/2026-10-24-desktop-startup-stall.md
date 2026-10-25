# Desktop preso em “Preparando o Lume” — 24/10/2026

## Evidência e limite do diagnóstico

O relato passou de “não abre” para uma foto do Lume aberto na página local
`resources/update.html`, com “Procurando novidades para você…” e “VERIFICANDO”.
O computador afetado usa Windows 10; reinstalar não resolveu. A versão exata e
o acesso pelo navegador nesse computador ainda não foram confirmados.

A foto comprova que o processo, a janela e a página local iniciaram. As hipóteses
anteriores de bloqueio antes da abertura ou falha na importação inicial do módulo
de atalhos deixam de explicar esta tentativa específica. Ela não comprova,
sozinha, se a espera é pelo atualizador ou pela conexão com o serviço.

## Lacuna encontrada no código publicado

O beta.23 abre a página local de atualização e, depois de 12 segundos, tenta
carregar o serviço mesmo se o atualizador não respondeu. Porém, a proteção de
inicialização anterior só era armada em `did-finish-load`, depois de
`did-navigate`. Uma navegação HTTP que continua pendente antes da resposta não
alcança esses eventos e pode manter o documento anterior visível. Uma página
que recebe HTML mas fica esperando recursos também escapava desse prazo.

Isso reproduz uma falha real da proteção de inicialização, compatível com a
imagem. A causa ambiental na máquina afetada — rede, proxy, certificado ou outro
fator — continua pendente de reprodução e diagnóstico local.

## Correção preparada

- Abrir diretamente o app; retirar a página de atualização do caminho crítico.
  A atualização Windows continua sendo verificada após 10 segundos, baixada em
  segundo plano e aplicada ao sair ou pelo reinício solicitado pelo usuário.
- Prazo de 20 segundos da navegação HTTP principal até receber a página. Ao
  exceder o prazo, abrir recuperação com `ERR_TIMED_OUT`.
- Iniciar o prazo de boot de 20 segundos ao receber a página, sem aguardar o
  término de imagens ou outros recursos. O sinal `rendererReady` o cancela.
- Ignorar navegações de subframes e rotas no mesmo documento; cancelar prazos
  anteriores ao iniciar outra navegação, abrir recuperação ou fechar a janela.
- Consumir rejeições de navegação esperadas ao cancelar uma carga travada.

As mudanças integram a Beta 24 e exigem um novo instalador para chegar ao
desktop instalado. A publicação usa o workflow unificado de instaladores e a
imagem do mesmo commit na Oracle; a situação da entrega deve ser confirmada
pelos registros da versão. Não há mudança nas proteções do Windows.

## Validação

Os testes usam eventos simulados do Electron e relógio controlado. Cobrem carga
sem resposta com a tela antiga ainda visível, HTML recebido sem fim da carga,
renderer saudável com imagem pendente, sinal de pronto antes do fim da carga,
subframes, navegação no mesmo documento, cancelamento, reconexão, erro de DNS,
fechamento e argumentos de eventos legados. Os testes não substituem repetir
a abertura no Windows 10 afetado.

## Teste no instalador atual

Pedir que a pessoa clique com o botão direito no ícone do Lume na área próxima
ao relógio e escolha **Reconectar ao Lume**. Esse comando já existe no beta.23 e
tenta navegar diretamente para o serviço. Se não abrir, testar
`https://lumesocial.online/app/login` no navegador do mesmo computador e obter
a tela ou erro resultante. Não é necessário reinstalar novamente para esse teste.

Uma tentativa de criar um arquivo auxiliar de teste foi rejeitada pela revisão
automática sem motivo específico. O arquivo não foi criado nem executado; o
procedimento acima usa somente o menu existente do app.
