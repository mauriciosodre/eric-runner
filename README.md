# Eric · O Dino-Futebolista

Uma aventura lateral alegre feita para os 4 anos do Eric, agora com Daniel e Samuel. Escolha um dos três heróis; todos começam com 20 corações. Colisões sem proteção tiram um coração, fazem piscar e desaceleram brevemente; os pontos permanecem. Ao zerar a vida, uma tela alegre mostra os pontos, o recorde, a escolha de herói e o botão “Vamos de novo!”.

[**Jogar online**](https://mauriciosodre.github.io/eric-runner/)

A publicação usa o GitHub Pages, a partir da raiz da branch `main`. Alterações enviadas para essa branch atualizam o site automaticamente. O arquivo `.nojekyll` mantém a publicação estática, sem processamento de Jekyll.

## Abrir e brincar

Abra `index.html` com um navegador moderno. Mantenha os 13 PNGs dos personagens na mesma pasta. Funciona localmente e sem internet, sem instalação e sem bibliotecas externas.

No celular, vire o aparelho para **landscape (horizontal)**. O jogo ocupa a área disponível do navegador, com o especial do herói e PULAR lado a lado na parte inferior, alvos de 76 px de altura, intervalo de 12 px e margens para recortes da tela. Na vertical, aparece um convite para virar o aparelho; uma corrida em andamento pausa, preservando progresso e poderes. Ao voltar para a horizontal, toque em Continuar. A orientação do aparelho é feita pelo usuário; a página se adapta a ela.

Todo o HTML, CSS e JavaScript do jogo está em **um único arquivo: `index.html`**. Eric usa `eric.png`, `eric-run.png`, `eric-actions.png`, `eric-roar.png` e `eric-roar-actions.png`. Daniel e Samuel usam, cada um, quatro arquivos: `<nome>.png`, `<nome>-run.png`, `<nome>-actions.png` e `<nome>-special.png`. Os recortes já estão embutidos no HTML e não precisam de arquivos JSON adicionais.

Antes de começar, a tela **Preparando a aventura!** mostra quantas imagens do herói escolhido estão prontas. A partida só é liberada depois do download, decodificação, validação das dimensões das folhas e preparação dos recortes. Isso também vale ao escolher outro herói e antes de reiniciar; teclado e toque respeitam a mesma espera. Não aparece um personagem provisório durante a espera.

Se uma imagem falhar ou demorar mais de 30 segundos, aparece **Tentar novamente**. A nova tentativa busca apenas os arquivos que falharam e conserva os já preparados. Respostas atrasadas de tentativas anteriores não liberam a partida. Imagens pendentes de outro herói não bloqueiam o escolhido. Após carregar, toque em “Vamos correr!” ou “Vamos de novo!”; esse gesto mantém a ativação de áudio e tela cheia no celular.

- **Começar:** botão “Vamos correr!”, toque no cenário, Z ou Espaço.
- **Pular:** toque no cenário, botão PULAR ou tecla **Z**. Espaço e seta para cima continuam como alternativas.
- **Especial:** botão RUGIR, SOPRAR ou BOLHAS conforme o herói, ou tecla **X**. R continua como alternativa. O especial começa pronto e recarrega sozinho em 6 segundos.
- **Pausar/continuar:** botão de pausa, tecla P ou Escape.
- **Tela cheia:** no celular, começa junto com “Vamos correr!”. O botão de quatro cantos também ativa no computador e permite sair. Usa a API nativa com navegação oculta e tenta manter landscape quando o navegador permite. Ao sair da tela cheia, a partida pausa. Em navegadores que recusam a API, o cenário é ampliado dentro da página; os gestos e controles do sistema continuam disponíveis.
- **Vida:** 20 corações. Cada esbarrão tira apenas um, com 2 segundos de proteção para evitar danos seguidos. Amigos, salto e escudo preservam a vida.
- **Vamos de novo:** ao zerar a vida, reinicia a pista e restaura os 20 corações, preservando o herói escolhido, o recorde e a preferência de som. Também é possível escolher outro herói antes de reiniciar.
- **Som:** botão do alto-falante. Começa desligado. Sete gravações estão embutidas no HTML; não precisam de download durante o jogo.
- **Bola:** chute automático, balão GOOOL! e confetes.
- **Batatas:** velocidade extra e poeira por 3 segundos.
- **Moeda dino/fóssil:** escudo por 1,5 segundo e recarga imediata do especial. Não encurta uma bolha protetora ainda ativa.

O jogo pausa ao sair da aba. A pausa preserva o tempo dos poderes.

## Três heróis

Os cartões de Eric, Daniel e Samuel aparecem antes da corrida e após o fim da partida. A escolha fica salva na chave `eric-runner-character-v1` do `localStorage`; se não houver uma escolha válida, Eric é o padrão. Durante a corrida, o herói permanece o mesmo. O recorde é compartilhado entre os três.

- **Eric, o Dino-Futebolista:** traje verde, rugido com sua voz real, onda que afugenta os travessos e escudo de 1,5 segundo.
- **Daniel, o Ptero:** traje azul e laranja, Sopro do Ptero que afugenta os travessos e aproxima bolas e tesouros à frente por 1,2 segundo. Tem escudo de 1,5 segundo e um som suave de vento.
- **Samuel, o Tricerátops:** traje roxo e amarelo, menor como uma criança de 2 anos. Sua Bolha de Abraço protege por 3 segundos e envolve os travessos visíveis em bolhas que flutuam para longe, acompanhadas por notas leves.

Coelhos e papagaios continuam amigos de todos. Salto, velocidade normal, vinte corações, margem de coleta e pontuação seguem as mesmas regras para os três.

## Placar e recorde

O placar soma 1 ponto por metro, 100 por gol, 25 por tesouro, 100 por estrela, 25 por travesso afugentado e 10 por encontro com um amigo. Danos não descontam pontos.

O recorde é salvo no `localStorage`, na chave `eric-runner-highscore-v1`, no navegador deste aparelho. Sobrevive a reiniciar a partida e a recarregar a página. As gravações são limitadas a uma por segundo; sair da aba, pausar e terminar a partida também salvam o valor mais recente. Se o navegador bloquear armazenamento, o jogo continua e conserva o recorde durante a aba, sem prometer persistência. Limpar os dados do site apaga o recorde.

## Mais brincadeiras, sem ficar difícil

- Blocos, cones e tronquinhos ficam na pista. O aviso **↑ PULE** identifica os obstáculos. Passar por cima rende uma comemoração; esbarrar sem escudo tira um coração e desacelera um pouco.
- Coelhos e papagaios são **sempre amigos**, com corações verdes e posição na grama ao lado da pista. Nunca machucam nem desaceleram o Eric, mesmo sem pular. A bola também pode fazê-los brincar; o papagaio deixa uma moeda.
- Os inimigos são os travessos **Gelequinha**, **Lata-Lelé** e **Nuvem Resmungona**: uma gelatina lilás, um robô de corda e uma nuvem com pezinhos. Também aparecem o **Balão Birrento**, o **Cogumelo Resmungão** e o **Carrinho Desgovernado**: um balão com sapatinhos, um cogumelo de chapéu com bolinhas e um carrinho de brinquedo. Todos são desenhados pelo Canvas, sem imagens externas adicionais. Eles têm silhuetas próprias e o aviso **! RUGIR**. O rugido abre seus olhos de surpresa e faz todos correrem para fora da tela, sem violência. Amigos continuam tranquilos.
- Também é possível saltar os travessos, afastá-los com uma bola chutada ou passar protegido pelo escudo. Encostar sem proteção tira um coração, faz piscar e desacelera brevemente; os pontos ficam intactos.
- Há tarefas curtas: dois gols, dois pulos, dois encontros, três tesouros e afugentar dois travessos. Cada tarefa dá uma estrela e inicia outra. Não há prazo nem penalidade por ignorá-las.
- O jogo mantém espaço entre obstáculos e mobs, inclusive durante o turbo e no celular.

## Animação com os pés no chão

`eric-run.png` contém oito etapas menores de um ciclo de corrida em uma grade 4 × 2. A velocidade de troca acompanha a distância percorrida, com cerca de 16 quadros por segundo na velocidade normal. A posição horizontal do rosto foi medida em cada quadro e usada como âncora para evitar deslocamentos bruscos da cabeça. Os retângulos foram medidos pelo canal alfa; a sola fica apoiada no chão. O personagem só sobe quando a física está em um salto.

Os recortes da segunda linha da corrida começam abaixo das solas do quadro acima, que invadiam o início dessa linha. Cada quadro é copiado uma vez para um Canvas separado com borda transparente; assim, a redução na tela não mistura pixels de imagens vizinhas e não cria a linha preta acima do capacete.

`eric-roar-actions.png` tem seis poses frontais de preparação, força, rugido e retorno, inspiradas na referência original. A sequência dura 1,05 segundo, com mistura suave entre poses num Canvas transparente. A escala é calculada pela largura do rosto, igual à da corrida, e a âncora horizontal também é a mesma; o Eric apenas se agacha. As solas ficam no chão. A pausa congela a sequência. `eric-roar.png` é a pose de reserva; `eric-actions.png` mantém salto, chute e descanso, além das poses anteriores de reserva.

A pose de chute aparece ao encontrar a bola. A pose de rugido acompanha o especial acionado pelo botão ou pela tecla X (também aceita R). O rugido também funciona no ar, mantendo a pose de salto. Na tela de início e durante a pausa, o Eric fica em pé usando diretamente `eric.png`, a imagem frontal aprovada. A pose de descanso da folha de animação permanece apenas como reserva caso essa imagem não carregue; assim, o rosto inicial não é uma nova interpretação do personagem.

Daniel e Samuel têm, cada um, oito quadros de corrida, três de salto, três de chute e seis de especial. O renderer isola cada recorte com borda transparente, ancora as solas no chão e mantém a escala do capacete entre ações. A pose frontal aprovada aparece no início e na pausa. Esses recortes são medidos no desenvolvimento e embutidos por `python scripts/embed-character-frames.py`, usando Pillow e NumPy; o jogo não lê pixels do Canvas, inclusive quando aberto diretamente com `file://`. O script usa os manifests locais de `output/imagegen` e os PNGs aprovados, sem modificar imagens.

## Sons e créditos

O chute tem um impacto macio com uma pequena fanfarra. A aterrissagem e os passos usam gravações discretas de grama. O turbo combina vento filtrado com uma subida musical; o pulo tem uma mola sonora. O rugido é a voz real do Eric, gravada pela família: 2,58 segundos, com limpeza discreta, bordas suaves e volume equilibrado. A reprodução mantém a afinação e a velocidade naturais dele. Uma onda visual e um tremor pequeno acompanham o especial. Há um compressor na saída para controlar picos. Desativar o som interrompe os efeitos em andamento.

Fontes das gravações:

- **Kenney — [Impact Sounds](https://kenney.nl/assets/impact-sounds), licença [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/):** `impactSoft_medium_000.ogg` (chute), `impactSoft_heavy_001.ogg` (esbarrão), `footstep_grass_002.ogg` (aterrissagem), `footstep_grass_000.ogg` e `footstep_grass_001.ogg` (passos), `impactBell_heavy_000.ogg` (poder dino).
- **Eric — rugido original:** gravação fornecida pelo pai para este jogo; não está sob a licença CC0 dos demais efeitos.

Os efeitos musicais, o vento do Daniel e as bolhas do Samuel são sintetizados pelo próprio JavaScript. Apenas Eric usa a gravação do rugido. Os créditos também estão em `LICENSE_AUDIO.md`. O pacote distribuído não depende de arquivos de áudio externos.

Para recriar a inclusão dos mesmos arquivos durante o desenvolvimento, rode `python scripts/embed-audio.py`. Os arquivos de origem ficam em `output/audio`; esse script e essa pasta não são necessários para jogar. `scripts/prepare-roar.py` documenta o tratamento da gravação atual a partir de um WAV PCM de 16 bits, usando NumPy e SciPy, e salva `output/audio/eric-roar.wav`. O original é preservado. Os cortes de início e fim devem ser ajustados nesse script para uma nova gravação.

## Trocar o personagem

Substitua `eric.png` por outra imagem PNG com fundo transparente, corpo inteiro e olhando à direita. Para usar outro nome ou caminho, procure esta linha no HTML:

```js
const ERIC_IMAGE_URL = 'eric.png?v=10';
```

Há comentários em português nessa seção. Para mostrar exclusivamente uma nova imagem estática, deixe `ERIC_ACTIONS_URL = ''`. Se trocar a folha de animação, ajuste os retângulos em `actionFrames`, a escala de referência e as dimensões passadas a `queueCharacterImage`. O salto inclina levemente o personagem. Se alguma imagem estiver ausente, a tela de carregamento oferece uma nova tentativa; mantenha todos os PNGs na pasta para liberar a aventura completa.

As imagens foram geradas com a ferramenta integrada a partir dos personagens e das fotos de referência. Cada herói usa sua pose frontal aprovada como referência do rosto. Eric mantém suas imagens anteriores. Daniel e Samuel têm rostos, proporções e trajes próprios. Os sufixos de versão evitam reutilizar imagens antigas armazenadas pelo navegador; o nome dos arquivos continua o mesmo. Os prompts locais estão em `output/imagegen/eric-approved-face-prompts.md`, `output/imagegen/eric-fluid-run-and-roar-prompts.md`, `output/imagegen/eric-roar-sequence-prompt.md`, `output/imagegen/daniel-animation-prompts-v1.md` e `output/imagegen/samuel-animation-prompts-v1.md`.

## Verificação

```powershell
node --test tests/game.test.cjs
```

Os 46 testes exercitam a física extraída do próprio HTML: salto e aterrissagem, chute único, duração e expiração dos poderes, proteção, dano unitário, 20 corações, proteção de 2 segundos, escudo breve sem imunidade permanente, dano em colisões sucessivas, fim de partida, reinício, pontuação, margem de coleta, pausa, animação, amigos sem penalidade, fuga dos seis inimigos, onda limitada à tela, recarga do especial, tarefas, espaçamento durante o turbo e dez minutos de corrida protegida simulada com memória limitada. Também verificam seleção e reinício com cada herói, fases dos especiais, atração de itens, bolhas e duração da proteção, pontuação única e amigos preservados.

`tests/browser.test.cjs` verifica tela cheia nativa, pausa ao sair, fallback quando a API é recusada, vida, novos mobs, fim e reinício, recorde após reload e tratamento de storage bloqueado, além do HTML local no Chromium com Playwright disponível no ambiente de desenvolvimento. Confere a imagem frontal aprovada no início e na pausa, inclusive no celular, as oito fases da corrida com solas no chão e sem linha preta, as seis poses do rugido com escala do rosto consistente, tarefas, teclas Z/X e alternativa Espaço, toque nos dois botões de 76 px com intervalo de 12 px, perda de vida após coletar moeda e deixar o escudo expirar, pausa, gols, poderes, sete gravações decodificadas e reprodução completa do rugido real do Eric em velocidade natural, fuga dos travessos sem assustar amigos, landscape em 844 × 390 e 667 × 320, convite na vertical, pausa por rotação preservando poderes e geometria preservada quando o painel é ocultado. As capturas ficam em `output/verification`. Playwright não é uma dependência do jogo.

`tests/characters.browser.test.cjs` confere a escolha dos três heróis, persistência e storage bloqueado, início/pausa/reinício, imagens frontais aprovadas, os 40 novos quadros com escala consistente e solas alinhadas, recuperação de imagens ausentes, sons próprios, vento, bolhas e os cartões no celular. Confere também as poses frontais com leitura de pixels bloqueada, abrindo o arquivo local sem permissões extras do Chromium.

`tests/loading.browser.test.cjs` usa um servidor temporário e respostas de rede controladas para conferir downloads e decodificação atrasados, progresso, bloqueio de botões/teclado/toque, falhas de rede/dimensões/decodificação, timeout e nova tentativa apenas dos arquivos faltantes. Também confere os três heróis, espera antes do reinício e o loading no celular em landscape. Não exige servidor nem dependências adicionais para jogar.

Para executar a verificação do navegador, instale Playwright no ambiente de desenvolvimento e rode `node tests/browser.test.cjs`, `node tests/characters.browser.test.cjs` e `node tests/loading.browser.test.cjs`. `PLAYWRIGHT_MODULE` pode apontar para uma instalação já existente. Defina `GAME_URL` com o endereço publicado para conferir a versão online nas duas primeiras suítes. A suíte de loading sempre usa seu servidor temporário para reproduzir a rede lenta e as falhas.

Os arquivos de criação e pacotes em `output/` ficam no ambiente local e não são enviados ao repositório. O site utiliza o HTML e as 13 imagens dos personagens; os sons estão embutidos.
