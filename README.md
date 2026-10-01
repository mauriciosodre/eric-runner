# Eric · O Dino-Futebolista

Uma aventura lateral alegre feita para os 4 anos do Eric. Eric começa com 20 corações. Colisões sem proteção tiram um coração, fazem piscar e desaceleram brevemente; os pontos permanecem. Ao zerar a vida, uma tela alegre mostra os pontos, o recorde e o botão “Vamos de novo!”.

[**Jogar online**](https://mauriciosodre.github.io/eric-runner/)

A publicação usa o GitHub Pages, a partir da raiz da branch `main`. Alterações enviadas para essa branch atualizam o site automaticamente. O arquivo `.nojekyll` mantém a publicação estática, sem processamento de Jekyll.

## Abrir e brincar

Abra `index.html` com um navegador moderno. Mantenha `eric.png`, `eric-actions.png`, `eric-run.png`, `eric-roar.png` e `eric-roar-actions.png` na mesma pasta. Funciona localmente e sem internet, sem instalação e sem bibliotecas externas.

No celular, vire o aparelho para **landscape (horizontal)**. O jogo ocupa a área disponível do navegador, com RUGIR e PULAR lado a lado na parte inferior, alvos de 76 px de altura, intervalo de 12 px e margens para recortes da tela. Na vertical, aparece um convite para virar o aparelho; uma corrida em andamento pausa, preservando progresso e poderes. Ao voltar para a horizontal, toque em Continuar. A orientação do aparelho é feita pelo usuário; a página se adapta a ela.

Todo o HTML, CSS e JavaScript do jogo está em **um único arquivo: `index.html`**. As imagens externas são a corrida `eric-run.png`, o rugido animado `eric-roar-actions.png`, o rugido de reserva `eric-roar.png`, a folha das demais ações `eric-actions.png` e o personagem de reserva `eric.png`.

- **Começar:** botão “Vamos correr!”, toque no cenário, Z ou Espaço.
- **Pular:** toque no cenário, botão PULAR ou tecla **Z**. Espaço e seta para cima continuam como alternativas.
- **Rugir:** botão RUGIR ou tecla **X**. R continua como alternativa. A onda do rugido faz os travessos visíveis fugirem e ativa o escudo por 1,5 segundo. O especial começa pronto e recarrega sozinho em 6 segundos.
- **Pausar/continuar:** botão de pausa, tecla P ou Escape.
- **Tela cheia:** no celular, começa junto com “Vamos correr!”. O botão de quatro cantos também ativa no computador e permite sair. Usa a API nativa com navegação oculta e tenta manter landscape quando o navegador permite. Ao sair da tela cheia, a partida pausa. Em navegadores que recusam a API, o cenário é ampliado dentro da página; os gestos e controles do sistema continuam disponíveis.
- **Vida:** 20 corações. Cada esbarrão tira apenas um, com 2 segundos de proteção para evitar danos seguidos. Amigos, salto e escudo preservam a vida.
- **Vamos de novo:** ao zerar a vida, reinicia a pista e restaura os 20 corações, preservando o recorde e a preferência de som.
- **Som:** botão do alto-falante. Começa desligado. Sete gravações estão embutidas no HTML; não precisam de download durante o jogo.
- **Bola:** chute automático, balão GOOOL! e confetes.
- **Batatas:** velocidade extra e poeira por 3 segundos.
- **Moeda dino/fóssil:** escudo por 1,5 segundo e recarga imediata do rugido. O aviso DINO PRONTO! indica que o botão está disponível.

O jogo pausa ao sair da aba. A pausa preserva o tempo dos poderes.

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

## Sons e créditos

O chute tem um impacto macio com uma pequena fanfarra. A aterrissagem e os passos usam gravações discretas de grama. O turbo combina vento filtrado com uma subida musical; o pulo tem uma mola sonora. O rugido usa uma voz mais aguda, curta e suave, com os graves removidos para lembrar um pequeno dinossauro brincando de "rááá!". A gravação é um efeito de monstro ajustado, não uma gravação de criança. Uma onda visual e um tremor pequeno acompanham o especial. O volume dos efeitos é equilibrado e há um compressor na saída para controlar picos. Desativar o som interrompe os efeitos em andamento.

Fontes das gravações, ambas com licença [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/):

- **Kenney — [Impact Sounds](https://kenney.nl/assets/impact-sounds):** `impactSoft_medium_000.ogg` (chute), `impactSoft_heavy_001.ogg` (esbarrão), `footstep_grass_002.ogg` (aterrissagem), `footstep_grass_000.ogg` e `footstep_grass_001.ogg` (passos), `impactBell_heavy_000.ogg` (poder dino).
- **123agumon — [Dinosaur Growl](https://freesound.org/people/123agumon/sounds/147527/), publicado no Freesound em 23/02/2012:** trecho da prévia MP3 de alta qualidade, com velocidade, filtro e envelope ajustados para o jogo.

Os efeitos musicais e de vento são sintetizados pelo próprio JavaScript. Os créditos também estão em `LICENSE_AUDIO.md`. O pacote distribuído não depende de arquivos de áudio externos.

Para recriar a inclusão dos mesmos arquivos durante o desenvolvimento, rode `python scripts/embed-audio.py`. Os arquivos de origem ficam em `output/audio`; esse script e essa pasta não são necessários para jogar.

## Trocar o personagem

Substitua `eric.png` por outra imagem PNG com fundo transparente, corpo inteiro e olhando à direita. Para usar outro nome ou caminho, procure esta linha no HTML:

```js
const ERIC_IMAGE_URL = 'eric.png?v=10';
```

Há comentários em português nessa seção. Para mostrar exclusivamente uma nova imagem estática, deixe `ERIC_ACTIONS_URL = ''`. Se trocar a folha de animação, ajuste os retângulos em `actionFrames`, a escala de referência e a verificação das dimensões no evento `onload`. O salto inclina levemente o personagem. Se as imagens estiverem ausentes, um desenho provisório permite continuar brincando.

As imagens foram geradas com a ferramenta integrada a partir do personagem e das fotos de referência. A versão atual usa a pose frontal aprovada pelo pai como referência fixa do rosto, com o rosto mais voltado à câmera. O PNG de reserva também mantém essa pose aprovada. Os sufixos `?v=6`, `?v=7`, `?v=9` e `?v=10` evitam reutilizar as imagens antigas armazenadas pelo navegador; o nome dos arquivos continua o mesmo. Os prompts estão em `output/imagegen/eric-approved-face-prompts.md`, `output/imagegen/eric-fluid-run-and-roar-prompts.md` e `output/imagegen/eric-roar-sequence-prompt.md`.

## Verificação

```powershell
node --test tests/game.test.cjs
```

Os 34 testes exercitam a física extraída do próprio HTML: salto e aterrissagem, chute único, duração e expiração dos poderes, proteção, dano unitário, 20 corações, proteção de 2 segundos, escudo breve sem imunidade permanente, dano em colisões sucessivas, fim de partida, reinício, pontuação, margem de coleta, pausa, animação, amigos sem penalidade, fuga dos seis inimigos, onda limitada à tela, recarga do especial, tarefas, espaçamento durante o turbo e dez minutos de corrida protegida simulada com memória limitada.

`tests/browser.test.cjs` verifica tela cheia nativa, pausa ao sair, fallback quando a API é recusada, vida, novos mobs, fim e reinício, recorde após reload e tratamento de storage bloqueado, além do HTML local no Chromium com Playwright disponível no ambiente de desenvolvimento. Confere a imagem frontal aprovada no início e na pausa, inclusive no celular, as oito fases da corrida com solas no chão e sem linha preta, as seis poses do rugido com escala do rosto consistente, tarefas, teclas Z/X e alternativa Espaço, toque nos dois botões de 76 px com intervalo de 12 px, perda de vida após coletar moeda e deixar o escudo expirar, pausa, gols, poderes, sete gravações decodificadas e reprodução do áudio anterior do rugido, fuga dos travessos sem assustar amigos, landscape em 844 × 390 e 667 × 320, convite na vertical, pausa por rotação preservando poderes e geometria preservada quando o painel é ocultado. As capturas ficam em `output/verification`. Playwright não é uma dependência do jogo.

Para executar a verificação do navegador, instale Playwright no ambiente de desenvolvimento e rode `node tests/browser.test.cjs`. `PLAYWRIGHT_MODULE` pode apontar para uma instalação já existente. Defina `GAME_URL` com o endereço publicado para conferir a versão online em vez do HTML local.

Os arquivos de criação e pacotes em `output/` ficam no ambiente local e não são enviados ao repositório. O site utiliza o HTML e as cinco imagens do personagem; os sons estão embutidos.
