# Eric · O Dino-Futebolista

Uma aventura lateral alegre feita para os 4 anos do Eric, agora com Daniel e Samuel. Escolha um dos três heróis; todos começam com 20 corações. Colisões sem proteção tiram um coração, fazem piscar e desaceleram brevemente; os pontos permanecem. Ao zerar a vida, uma tela alegre mostra os pontos, o recorde, a escolha de herói e o botão “Vamos de novo!”.

[**Jogar online**](https://mauriciosodre.github.io/eric-runner/)

A publicação usa o GitHub Pages, a partir da raiz da branch `main`. Alterações enviadas para essa branch atualizam o site automaticamente. O arquivo `.nojekyll` mantém a publicação estática, sem processamento de Jekyll.

## Abrir e brincar

Abra `index.html` com um navegador moderno. Mantenha os 16 WebPs dos personagens e miniaturas na mesma pasta. Funciona localmente e sem internet, sem instalação e sem bibliotecas externas. Os 13 PNGs originais permanecem no repositório como fontes da arte aprovada.

No celular, vire o aparelho para **landscape (horizontal)**. O especial do herói e PULAR ficam lado a lado na parte inferior, com margens para recortes da tela. Os alvos têm 76 px de altura nas telas maiores, 64 px quando a altura disponível é de até 350 px e 56 px até 290 px. Nas telas baixas, os dois ficam à direita com intervalo de 10 px, liberando a metade esquerda da pista. O piso reserva a altura real dos controles, sua margem inferior e 16 px de respiro; o aviso PULE! fica dentro do botão. Na vertical, aparece um convite para virar o aparelho; uma corrida em andamento pausa, preservando progresso e poderes. Ao voltar para a horizontal, toque em Continuar. A orientação do aparelho é feita pelo usuário; a página se adapta a ela.

Todo o HTML, CSS e JavaScript do jogo está em **um único arquivo: `index.html`**. Eric usa `eric.webp`, `eric-run.webp`, `eric-actions.webp`, `eric-roar.webp` e `eric-roar-actions.webp`. Daniel e Samuel usam, cada um, quatro arquivos: `<nome>.webp`, `<nome>-run.webp`, `<nome>-actions.webp` e `<nome>-special.webp`. Os cartões usam três miniaturas `<nome>-thumb.webp` de 128 × 192 px. Os recortes já estão embutidos no HTML e não precisam de arquivos JSON adicionais.

Antes de começar, a tela **Preparando a aventura!** mostra quantas imagens do herói escolhido estão prontas. A partida só é liberada depois do download, decodificação, validação das dimensões das folhas e preparação dos recortes. Isso também vale ao escolher outro herói e antes de reiniciar; teclado e toque respeitam a mesma espera. Não aparece um personagem provisório durante a espera.

A página baixa as folhas apenas do herói escolhido, inclusive quando a escolha veio do armazenamento. Os outros cartões usam somente as miniaturas; suas folhas começam a baixar ao selecionar aquele personagem. As três poses frontais têm compressão sem perdas, com os mesmos pixels dos rostos aprovados. As dez folhas de animação usam qualidade 95, preservando dimensões e transparência. Em uma simulação sem cache de 5 Mb/s e 80 ms de latência, preparar o Eric completo caiu de cerca de 24 para 6,6 segundos; seu conjunto inicial de imagens caiu de 14,29 para 3,45 MB. Daniel baixa 2,98 MB e Samuel 3,07 MB. O tempo real depende da conexão.

Se uma imagem falhar ou demorar mais de 30 segundos, aparece **Tentar novamente**. A nova tentativa busca apenas os arquivos que falharam e conserva os já preparados. Respostas atrasadas de tentativas anteriores não liberam a partida. Imagens pendentes de outro herói não bloqueiam o escolhido. Após carregar, toque em “Vamos correr!” ou “Vamos de novo!”; esse gesto mantém a ativação de áudio e tela cheia no celular.

- **Começar:** botão “Vamos correr!”, toque no cenário, Z ou Espaço.
- **Pular:** toque no cenário, botão PULAR ou tecla **Z**. Espaço e seta para cima continuam como alternativas.
- **Especial:** botão RUGIR, SOPRAR ou BOLHAS conforme o herói, ou tecla **X**. R continua como alternativa. O especial começa pronto e recarrega sozinho em 6 segundos.
- **Pausar/continuar:** botão de pausa, tecla P ou Escape.
- **Voltar ao início:** na pausa, encerra a corrida atual e volta à seleção dos três heróis. Conserva o recorde, a escolha atual, a preferência de som, as imagens carregadas e a tela cheia. A nova partida aguarda “Vamos correr!”, com vinte corações e a pista limpa.
- **Tela cheia:** no celular, começa junto com “Vamos correr!”. O botão de quatro cantos também ativa no computador e permite sair. Usa a API nativa com navegação oculta e tenta manter landscape quando o navegador permite. Ao sair da tela cheia, a partida pausa. Em navegadores que recusam a API, o cenário é ampliado dentro da página; os gestos e controles do sistema continuam disponíveis.
- **Vida:** 20 corações. Cada esbarrão tira apenas um, com 2 segundos de proteção para evitar danos seguidos. Amigos, salto e escudo preservam a vida.
- **Vamos de novo:** ao zerar a vida, reinicia a pista e restaura os 20 corações, preservando o herói escolhido, o recorde e a preferência de som. Também é possível escolher outro herói antes de reiniciar.
- **Trocar personagem:** na tela final, volta à seleção inicial. Também é possível tocar diretamente nos cartões da tela final e depois em “Vamos de novo!”.
- **Álbum:** botão do álbum no alto da tela, ou “Ver álbum” na pausa e no resultado. Escolha um filhote já descoberto para acompanhar o herói, ou “Sem companheiro”. Fechar o álbum retoma a corrida somente se ela estava em andamento; na pausa e no resultado, volta à mesma tela.
- **Som:** botão do alto-falante. Começa desligado. Sete gravações estão embutidas no HTML; não precisam de download durante o jogo.
- **Bola:** chute automático, balão GOOOL! e confetes.
- **Batatas:** velocidade extra e poeira por 3 segundos.
- **Moeda dino/fóssil:** escudo por 1,5 segundo e recarga imediata do especial. Não encurta uma bolha protetora ainda ativa.

O jogo pausa ao sair da aba. A pausa preserva o tempo dos poderes.

## Três heróis

Os cartões de Eric, Daniel e Samuel aparecem antes da corrida e após o fim da partida. A escolha fica salva na chave `eric-runner-character-v1` do `localStorage`; se não houver uma escolha válida, Eric é o padrão. Durante a corrida, o herói permanece o mesmo. O recorde é compartilhado entre os três.

- **Eric, o Dino-Futebolista:** traje verde, rugido com sua voz real, onda que afugenta os travessos e escudo de 1,5 segundo.
- **Daniel, o Ptero:** traje azul e laranja, Sopro do Ptero que afugenta os travessos e aproxima bolas e tesouros à frente por 1,2 segundo. Tem escudo de 1,5 segundo; o rugido acompanha o som suave de vento.
- **Samuel, o Tricerátops:** traje roxo e amarelo, menor como uma criança de 2 anos. Sua Bolha de Abraço protege por 3 segundos e envolve os travessos visíveis em bolhas que flutuam para longe, acompanhadas pelo rugido e por notas leves.

Coelhos e papagaios continuam amigos de todos. Salto, velocidade normal, vinte corações, margem de coleta e pontuação seguem as mesmas regras para os três.

## Placar e recorde

O placar soma 1 ponto por metro, 100 por gol, 25 por tesouro, 100 por estrela, 25 por travesso afugentado e 10 por encontro com um amigo. Danos não descontam pontos.

O recorde é salvo no `localStorage`, na chave `eric-runner-highscore-v1`, no navegador deste aparelho. Sobrevive a reiniciar a partida e a recarregar a página. As gravações são limitadas a uma por segundo; sair da aba, pausar e terminar a partida também salvam o valor mais recente. Se o navegador bloquear armazenamento, o jogo continua e conserva o recorde durante a aba, sem prometer persistência. Limpar os dados do site apaga o recorde.

## Mais brincadeiras, sem ficar difícil

- Blocos, cones, tronquinhos, pneus e caixotes ficam na pista. São brinquedos maiores, com contorno forte, faixa âmbar no chão e **↑ PULE!** acompanhado por um arco de salto. O botão PULAR recebe a mesma cor e um aviso antes do contato. Passar por cima rende uma comemoração; esbarrar sem escudo tira um coração e desacelera um pouco. No celular, a pista fica inteira acima dos controles.
- Coelhos, papagaios, dinos, tartarugas e borboletas são **sempre amigos**, com corações verdes e posição na grama ao lado da pista. Nunca machucam nem desaceleram o herói, mesmo sem pular. A bola também pode fazê-los brincar; o papagaio deixa uma moeda.
- Os inimigos são os travessos **Gelequinha**, **Lata-Lelé** e **Nuvem Resmungona**: uma gelatina lilás, um robô de corda e uma nuvem com pezinhos. Também aparecem o **Balão Birrento**, o **Cogumelo Resmungão** e o **Carrinho Desgovernado**: um balão com sapatinhos, um cogumelo de chapéu com bolinhas e um carrinho de brinquedo. Todos são desenhados pelo Canvas, sem imagens externas adicionais. Eles têm silhuetas próprias e o aviso **! RUGIR**. O rugido abre seus olhos de surpresa e faz todos correrem para fora da tela, sem violência. Amigos continuam tranquilos.
- Também é possível saltar os travessos, afastá-los com uma bola chutada ou passar protegido pelo escudo. Encostar sem proteção tira um coração, faz piscar e desacelera brevemente; os pontos ficam intactos.
- Há tarefas curtas: dois gols, dois pulos, dois encontros, três tesouros e afugentar dois travessos. Cada tarefa dá uma estrela e inicia outra. Não há prazo nem penalidade por ignorá-las.
- O jogo mantém espaço entre obstáculos e mobs, inclusive durante o turbo e no celular.

## Ovos, festas e amigos dinos

Cada missão concluída racha o ovo no alto da tela. Na terceira, nasce um filhote e a aventura pausa para mostrar o novo amigo. “Brincar com ele!” escolhe esse companheiro e continua a corrida; “Continuar” mantém a escolha anterior. Não há prazo para abrir o ovo, e as rachaduras permanecem ao reiniciar ou trocar de herói.

O álbum reúne doze amigos: **Pipo** (T-rex), **Lili** (Tricerátops), **Tico** (Pterossauro), **Bubi** (Estegossauro), **Nino** (Braquiossauro), **Zazu** (Anquilossauro), **Fifi** (Carnotauro), **Duda** (Parasaurolofo), **Ravi** (Pterodáctilo), **Lola** (Espinossauro), **Mimo** (Diplodoco) e **Kiko** (Paquicefalossauro). Cada um tem silhueta, expressão e detalhes próprios. Há duas páginas de seis cartões grandes, com setas para navegar; abrir o álbum mostra a página do companheiro escolhido.

O primeiro ovo apresenta Pipo. Depois, os ovos sorteiam qualquer amigo, incluindo os já conhecidos. Um reencontro mostra “Um amigo voltou!” e acrescenta um coração à contagem daquele cartão, sem duplicá-lo. Após dois reencontros seguidos, o próximo ovo descobre alguém que falta. Quando todos foram descobertos, os sorteios continuam entre os doze. O escolhido acompanha qualquer herói e ajuda automaticamente com seu poder, sem receber dano.

A primeira festa chega após vinte segundos de corrida. A **Chuva de bolas** oferece dez segundos de gols fáceis. Depois de trinta segundos de pista normal, a **Festa do vulcão** lança confetes e oferece moedas e batatas em alturas acessíveis. As festas se alternam; retiram os perigos presentes e não geram obstáculos nem causam dano durante seus dez segundos. Pausar, abrir o álbum ou revelar um filhote congela esses tempos. Uma nova partida começa novamente com a Chuva de bolas.

O álbum, o companheiro escolhido, as rachaduras, os encontros de cada filhote, a sequência de reencontros e o total de resgates ficam na chave `eric-runner-album-v1` do `localStorage`, compartilhados entre Eric, Daniel e Samuel neste navegador. Sobrevivem a recarregar a página; limpar os dados do site apaga essa coleção. Álbuns anteriores conservam os dinos e cada amigo antigo começa com um encontro. Se o armazenamento estiver bloqueado, continuam funcionando durante a sessão. Os filhotes são desenhos SVG internos ao HTML e as festas usam Canvas, sem novos arquivos para baixar.

## Letras para brincar com palavras

Durante a corrida aparecem fichas grandes com letras para formar **DINO**, **BOLA**, **OVO**, **GOL** e **AMIGO**, nesta ordem e depois repetindo. O painel mostra a palavra e um desenho associado; as letras coletadas ficam verdes e a próxima recebe destaque. Aparece apenas a letra necessária, numa altura acessível sem pular. Deixar passar conserva o progresso e a mesma letra volta depois, sem penalidade ou prazo. O sopro também pode ajudar a recolhê-la.

Cada palavra completa rende uma estrela, recupera até um coração e ganha confetes e notas leves. A próxima palavra já fica pronta no painel. Letras não exigem um botão novo e não substituem as missões dos ovos. Resgates, festas e a brincadeira das cores suspendem o aparecimento de novas fichas; uma ficha existente ainda pode ser recolhida. Pausa, álbum e fim congelam tudo. Uma nova corrida recomeça em DINO; recorde e álbum continuam guardados.

## Arco-íris das cores

Depois de trinta e cinco segundos de pista normal, começa uma brincadeira segura de doze segundos. Estrelas sorridentes **vermelhas, azuis e amarelas** passam em duas alturas, alternando para que cada cor também possa ser recolhida sem pular. O painel usa cores e símbolos diferentes, e marca cada descoberta com um ✓. As três podem ser coletadas em qualquer ordem; repetições não apagam o progresso.

Encontrar todas rende uma estrela, recupera até um coração e toca uma pequena comemoração, uma única vez por brincadeira. Deixar passar uma cor não tira vida nem pontos. Novos obstáculos e travessos ficam suspensos; os perigos à frente são retirados. Amigos, salto e especiais continuam disponíveis. A missão e o painel das palavras ficam ocultos durante as cores e voltam ao terminar, com o progresso preservado; outra brincadeira aguarda cinquenta segundos de pista normal. Festas e resgates adiam esse relógio; pausa, álbum e fim congelam a atividade. Uma nova partida recomeça essa sequência, preservando recorde e álbum.

## Uma viagem com resgates e ajudantes

A cada quarenta segundos de corrida, o cenário passa suavemente ao próximo mundo: **Jardim Dino**, com árvores de blocos e vulcões de brinquedo; **Praia dos Brinquedos**, com palmeiras, conchas e castelos de areia; **Vale das Estrelas**, com cristais e estrelas em tons claros. Depois, volta ao jardim. Pista, salto e controles usam a mesma geometria em todos. Pausa, álbum, nascimento e fim da partida congelam o relógio e a transição; reiniciar volta ao jardim. A preferência de movimento reduzido troca os cenários diretamente.

O primeiro filhote pede ajuda após doze segundos de pista normal. No jardim ele está numa bolha: use o especial. Na praia ele está num castelo, e no vale tem um balão: pule perto ou use o especial. O aviso mostra o filhote e a ação, com destaque no botão correspondente. A área fica segura durante o resgate. Se a criança esperar seis segundos, chega uma ajuda gentil e o amigo também é salvo, sem falha ou perda de vida.

Cada resgate dá uma estrela, conta como encontro com amigo e recupera até dois corações, respeitando o máximo de vinte. O total fica visível e salvo no álbum. Depois, outro pedido aguarda trinta e dois segundos de pista normal; as festas suspendem essa espera. Um pedido que já começou pode terminar durante a festa. Os dinos resgatados visitam a aventura; a coleção continua sendo descoberta pelos ovos a cada três missões.

Escolha um companheiro no álbum para receber uma ajuda a cada doze segundos ativos. Quando o poder precisa de um alvo, ele espera um alvo próximo e visível para agir. Cada ajuda afeta apenas um alvo e tem uma animação própria:

| Amigo | Poder automático |
| --- | --- |
| Pipo | **Rugidinho:** afugenta um travesso próximo. |
| Lili | **Escudo amigo:** oferece dois segundos de proteção, sem encurtar outro escudo. |
| Tico | **Busca tesouros:** recolhe uma moeda ou fóssil próximo. |
| Bubi | **Abre caminho:** libera um obstáculo à frente. |
| Nino | **Dá coração:** recupera um coração; com a vida cheia, deixa uma moeda perto. |
| Zazu | **Superpasse:** chuta uma bola próxima ou oferece uma bola alcançável. |

Fifi usa Rugidinho, Duda usa Escudo amigo, Ravi busca tesouros, Lola abre caminho, Mimo dá coração e Kiko oferece Superpasse. Os doze também podem aparecer nos resgates. Amigos com asas voam junto do herói.

Os poderes pausam junto com a corrida. Reabrir o álbum ou selecionar novamente o mesmo amigo não renova a ajuda. Reiniciar conserva o companheiro, mas começa uma recarga nova. “Sem companheiro” desativa a ajuda automática. Nenhum botão de jogo adicional é necessário; os poderes de Eric, Daniel e Samuel continuam disponíveis.

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

Os efeitos musicais, o vento do Daniel e as bolhas do Samuel são sintetizados pelo próprio JavaScript. Os três especiais usam a gravação real do Eric como rugido; para Daniel e Samuel, essa voz é provisória até termos gravações próprias. Pipo e Fifi também usam a gravação no seu Rugidinho, em volume menor. A reprodução mantém o trecho completo e sua velocidade natural. Um áudio que termina de preparar após reiniciar ou trocar de herói não toca na nova aventura. Os créditos também estão em `LICENSE_AUDIO.md`. O pacote distribuído não depende de arquivos de áudio externos.

Para recriar a inclusão dos mesmos arquivos durante o desenvolvimento, rode `python scripts/embed-audio.py`. Os arquivos de origem ficam em `output/audio`; esse script e essa pasta não são necessários para jogar. `scripts/prepare-roar.py` documenta o tratamento da gravação atual a partir de um WAV PCM de 16 bits, usando NumPy e SciPy, e salva `output/audio/eric-roar.wav`. O original é preservado. Os cortes de início e fim devem ser ajustados nesse script para uma nova gravação.

## Trocar o personagem

Para usar uma nova imagem PNG com fundo transparente, corpo inteiro e olhando à direita, coloque `eric.png` na pasta do HTML e aponte esta variável para ela:

```js
const ERIC_IMAGE_URL = 'eric.png?v=novo'; // O jogo distribuído usa 'eric.webp?v=10'.
```

Há comentários em português nessa seção. A imagem frontal e as folhas de movimento são arquivos distintos; substituir a frontal não muda os quadros da corrida. Se trocar uma folha de animação, ajuste os retângulos em `actionFrames`, a escala de referência e as dimensões passadas a `queueCharacterImage`. O salto inclina levemente o personagem. Se alguma imagem estiver ausente, a tela de carregamento oferece uma nova tentativa; mantenha todos os WebPs distribuídos na pasta para liberar a aventura completa.

Para recriar os WebPs a partir dos 13 PNGs aprovados, rode `python scripts/optimize-assets.py` com Pillow disponível no ambiente de desenvolvimento. O script preserva os originais, verifica dimensões e alfa, usa compressão sem perdas nas poses frontais e gera as três miniaturas. Python e esse script não são necessários no navegador.

As imagens foram geradas com a ferramenta integrada a partir dos personagens e das fotos de referência. Cada herói usa sua pose frontal aprovada como referência do rosto. Eric mantém suas imagens anteriores. Daniel e Samuel têm rostos, proporções e trajes próprios. Os sufixos de versão evitam reutilizar imagens antigas armazenadas pelo navegador; os PNGs originais permanecem preservados. Os prompts locais estão em `output/imagegen/eric-approved-face-prompts.md`, `output/imagegen/eric-fluid-run-and-roar-prompts.md`, `output/imagegen/eric-roar-sequence-prompt.md`, `output/imagegen/daniel-animation-prompts-v1.md` e `output/imagegen/samuel-animation-prompts-v1.md`.

## Verificação

```powershell
node --test tests/game.test.cjs tests/adventure.test.cjs tests/album.test.cjs tests/journey.test.cjs tests/refinement.test.cjs tests/words.test.cjs tests/playtime.test.cjs
```

Os 46 testes exercitam a física extraída do próprio HTML: salto e aterrissagem, chute único, duração e expiração dos poderes, proteção, dano unitário, 20 corações, proteção de 2 segundos, escudo breve sem imunidade permanente, dano em colisões sucessivas, fim de partida, reinício, pontuação, margem de coleta, pausa, animação, amigos sem penalidade, fuga dos seis inimigos, onda limitada à tela, recarga do especial, tarefas, espaçamento durante o turbo e dez minutos de corrida protegida simulada com memória limitada. Também verificam seleção e reinício com cada herói, fases dos especiais, atração de itens, bolhas e duração da proteção, pontuação única e amigos preservados.

Mais nove testes verificam ovos e festas. Vinte e quatro testes do álbum cobrem os doze filhotes, sorteios, reencontros, garantia de descoberta, contagens, migração, validação, seleção e armazenamento bloqueado. Vinte testes da viagem verificam mundos, poderes e resgates. Seis testes do refinamento verificam os doze ajudantes, cinco brinquedos e novos amigos sem dano. Dez testes de palavras cobrem letras corretas e repetidas, recompensas únicas, ficha perdida, sopro, pausas e reinício. Treze testes das cores cobrem o trecho seguro, cada cor em alturas diferentes, ordem livre, prêmio único, repetição, pausa, término sem penalidade, reinício, sopro, turbo e memória limitada: **128 testes no total**.

`tests/browser.test.cjs` verifica tela cheia nativa, pausa ao sair, fallback quando a API é recusada, vida, novos mobs, fim e reinício, recorde após reload e tratamento de storage bloqueado, além do HTML local no Chromium com Playwright disponível no ambiente de desenvolvimento. Confere a imagem frontal aprovada no início e na pausa, inclusive no celular, as oito fases da corrida com solas no chão e sem linha preta, as seis poses do rugido com escala do rosto consistente, tarefas, teclas Z/X e alternativa Espaço, toque nos dois botões com tamanhos adaptados à tela e intervalo de 10 ou 12 px, perda de vida após coletar moeda e deixar o escudo expirar, pausa, gols, poderes, sete gravações decodificadas e reprodução completa do rugido real do Eric em velocidade natural, fuga dos travessos sem assustar amigos, landscape em 844 × 390 e 667 × 320, convite na vertical, pausa por rotação preservando poderes e geometria preservada quando o painel é ocultado. As capturas ficam em `output/verification`. Playwright não é uma dependência do jogo.

`tests/characters.browser.test.cjs` confere a escolha dos três heróis, persistência e storage bloqueado, início/pausa/reinício, imagens frontais aprovadas, os 40 novos quadros com escala consistente e solas alinhadas, recuperação de imagens ausentes, rugido nos três especiais, vento, bolhas e os cartões no celular. Confere o áudio preparado com atraso, evitando reprodução depois de reiniciar ou trocar de herói. Confere também as poses frontais com leitura de pixels bloqueada, abrindo o arquivo local sem permissões extras do Chromium.

`tests/loading.browser.test.cjs` usa um servidor temporário e respostas de rede controladas para conferir downloads e decodificação atrasados, progresso, bloqueio de botões/teclado/toque, falhas de rede/dimensões/decodificação, timeout e nova tentativa apenas dos arquivos faltantes. Também confere os três heróis, espera antes do reinício e o loading no celular em landscape. Não exige servidor nem dependências adicionais para jogar.

`tests/navigation.browser.test.cjs` usa cliques e toques reais no computador e em dois tamanhos de celular. Encerra a aventura por colisão, troca pelos cartões da tela final e pelo botão “Trocar personagem”. Confere “Continuar” e “Voltar ao início” na pausa, a pista limpa, vinte corações, preservação do recorde e preferência de som, e a nova partida com outro herói. Os botões devem aparecer inteiros na tela.

`tests/adventure.browser.test.cjs` confere o álbum vazio, a descoberta dos seis filhotes por missões, escolha e retirada do companheiro, rachaduras entre partidas e após reload, troca de herói, festas seguras e seus tempos, retomada correta ao fechar o álbum e armazenamento bloqueado. Também verifica missões concluídas imediatamente antes de pausar ou sair da aba, salvamento sem duplicar filhotes e foco de teclado dentro das escolhas. Usa cliques e toques reais no computador e em celulares de 844 × 390 e 667 × 320, conferindo que os botões do álbum e do nascimento cabem na tela.

`tests/journey.browser.test.cjs` verifica mundos aos quarenta segundos, pausas e avisos, os três tipos de resgate com teclado/toque/ajuda, recompensa única e salvamento imediatamente antes de interromper a página. Exercita os seis poderes por seleção real no álbum, persistência, recargas, retirada do companheiro e alternativas de Nino e Zazu quando não há alvo. Confere os controles e avisos nos dois tamanhos de celular e gera capturas dos três mundos.

`tests/refinement.browser.test.cjs` verifica indicação antecipada e salto real, o corpo do cone inteiro acima dos botões de toque, espaço entre missão e palavra, coleta por colisão, celebração sem esconder o cone, duas páginas do álbum, novos companheiros, contagens persistidas e reencontro por ovo real. Exercita quatro larguras de computador (600, 700, 761 e 1280 px), celulares em 667 × 320 e 844 × 390, e a pista com altura reduzida pelas barras do navegador em 568 × 247 e 667 × 247. A palavra mais larga, AMIGO, e o botão do álbum continuam visíveis. Nas janelas estreitas, um aviso temporário ocupa a faixa da palavra, que volta ao terminar a comemoração. Gera capturas de obstáculos, travessos, amigos, palavras e álbum.

`tests/mobile-space.browser.test.cjs` confere os controles vizinhos em 568 × 247, 667 × 320 e 844 × 390, área livre da pista, cone visível acima dos botões, aviso dentro de PULAR e funcionamento dos toques. `tests/playtime.browser.test.cjs` verifica o painel de cores em cinco tamanhos, pixels das estrelas fora dos controles, coleta por colisão, prêmio único, pausa, resultado e retorno às letras. `tests/performance.browser.test.cjs` verifica que cada escolha baixa somente suas folhas, recuperação quando arquivos de outro herói estão indisponíveis, limite de bytes, preparação em conexão lenta e dimensões/alfa das treze imagens, além dos pixels das três poses frontais.

Para executar a verificação do navegador, instale Playwright no ambiente de desenvolvimento e rode as dez suítes: `node tests/browser.test.cjs`, `node tests/characters.browser.test.cjs`, `node tests/loading.browser.test.cjs`, `node tests/navigation.browser.test.cjs`, `node tests/adventure.browser.test.cjs`, `node tests/journey.browser.test.cjs`, `node tests/refinement.browser.test.cjs`, `node tests/mobile-space.browser.test.cjs`, `node tests/playtime.browser.test.cjs` e `node tests/performance.browser.test.cjs`. `PLAYWRIGHT_MODULE` pode apontar para uma instalação já existente. Defina `GAME_URL` com o endereço publicado para conferir as suítes online. As suítes de loading e performance sempre usam seus servidores temporários para reproduzir a rede lenta e as falhas.

Os arquivos de criação e pacotes em `output/` ficam no ambiente local e não são enviados ao repositório. O site utiliza o HTML e os 16 WebPs dos personagens e miniaturas; os sons estão embutidos. Os PNGs ficam preservados como fontes e não são baixados durante o jogo.
