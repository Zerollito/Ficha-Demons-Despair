import { BestiaryMonster } from "../types";

export const DEFAULT_MONSTERS: Omit<BestiaryMonster, 'masterId' | 'id'>[] = [
  {
    "name": "Armis aranea / aranha gigante",
    "imageUrl": "Armis aranea.jpg",
    "maxHp": 20,
    "size": 0.8,
    "esquiva": 1,
    "acuracia": 1,
    "deslocamento": "6 metros",
    "bonus": "",
    "ataque": {
      "corte": 0,
      "feitico": 0,
      "impacto": 2,
      "elemental": 0,
      "potencial": 0,
      "magiaNegra": 0,
      "perfuracao": 3,
      "resistencia": 1
    },
    "defesa": {
      "corte": 2,
      "feitico": 1,
      "impacto": 1,
      "elemental": 1,
      "magiaNegra": 1,
      "perfuracao": 1
    },
    "local": "Cavernas e lugares fechados",
    "personalidade": "Moderada",
    "gostaNaoGosta": "Pequenos roedores. / Fogo.",
    "partesUteis": "Veneno, pinças, pelos, carapaça, olhos, teia.",
    "informacoes": "As aranhas gigantes são uma espécie nativa de Mauer, vivem em lugares fechados e escuros onde possam fazer tocas, que são forradas com sua teia formando uma seda, o que arrefece o esconderijo. maioria delas não se afasta de sua toca, nem mesmo para se alimentar, pois sentem a presença das presas pela vibração do solo. O macho normalmente é quem faz as viagens mais longas para encontrar as fêmeas. As Armis araneas são animais de bando e noctívagos. Alimentam-se de pequenos animais, que podem incluir pássaros, roedores ou anfíbios. Todas as espécies de Armis aranea apresentam canibalismo. O acasalamento das Armis araneas é como o da maioria das aranhas. Uma diferença é que o macho tem ganchos para prender as presas das fêmeas no ato sexual. Os machos têm seus pedipalpos modificados para a cópula. Normalmente o macho foge logo após o ato, antes que a fêmea recobre seu apetite, e morre poucos meses depois, devido a seu curto ciclo de vida. A fêmea armazena o esperma vivo num órgão especial, até chegar a época de botar os ovos. As fêmeas depositam entre 50 a 200 ovos num saco de seda que incubam por cerca de 6 semanas. Os ovos são bem grandes, e o saco pode chegar a ficar do tamanho de um melancia. Os filhotes já nascem com um bom tamanho. Após o nascimento as pequenas tarântulas não recebem cuidados parentais, ficam pouco tempo na toca e logo depois se dispersam. Elas podem chegar a 80cm de largura e pesa 10 quilos.",
    "habitos": "",
    "acoes": [
      {
        "id": "armis_1",
        "name": "Major, Mordida",
        "type": "Major",
        "categoria": "Perfuração",
        "acerto": 10,
        "dano": "1d8",
        "description": "Envenenamento instantâneo -50 : 2 dano"
      },
      {
        "id": "armis_2",
        "name": "Major, Salto",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 8,
        "dano": "1d10",
        "description": "Derrubar -70"
      },
      {
        "id": "armis_3",
        "name": "Minor, Teia",
        "type": "Minor",
        "categoria": "Feitiço",
        "acerto": 10,
        "dano": "-",
        "description": "O alvo fica preso no lugar, sem poder se mover até romper a teia com um teste de força maior ou igual a 16"
      },
      {
        "id": "armis_4",
        "name": "Minor, pelos urticantes",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 8,
        "dano": "-",
        "description": "Se contrai soltando uma nuvem de pelos urticantes em volta. Causa coceira e ardor, causando -2 de acerto e esquiva e -3 de dano."
      }
    ]
  },
  {
    "name": "Baku / Pã",
    "imageUrl": "Baku.jpg",
    "maxHp": 30,
    "size": 1,
    "esquiva": 1,
    "acuracia": 1,
    "deslocamento": "5 metros",
    "bonus": "+1 atletismo",
    "ataque": {
      "corte": 3,
      "feitico": 2,
      "impacto": 0,
      "elemental": 0,
      "potencial": 1,
      "magiaNegra": 4,
      "perfuracao": 3,
      "resistencia": 1
    },
    "defesa": {
      "corte": 1,
      "feitico": 1,
      "impacto": 1,
      "elemental": 1,
      "magiaNegra": 4,
      "perfuracao": 1
    },
    "local": "Goundospauh",
    "personalidade": "Moderado",
    "gostaNaoGosta": "Carne. / Prata.",
    "partesUteis": "Dentes.",
    "informacoes": "Conhecido como Pã, deus das florestas. Faz vítimas desmaiarem e esquecerem as últimas horas. Semelhante a um lobo com crânio exposto. Carnívoro carniceiro.",
    "habitos": "Usa magia negra para causar confusão. Atrai inimigos para lugares fechados para arremessar contra paredes.",
    "acoes": [
      {
        "id": "baku_1",
        "name": "Major, Colapso mental",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 0,
        "dano": "-",
        "description": "Causa perda de memória e desmaio ao alvo. -40"
      },
      {
        "id": "baku_2",
        "name": "Minor, Golpe de garra",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 10,
        "dano": "2d4",
        "description": "Putrefação -50, sangramento -70"
      },
      {
        "id": "baku_3",
        "name": "Minor, Mordida",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 12,
        "dano": "1d6",
        "description": "Putrefação -50, sangramento -60"
      },
      {
        "id": "baku_4",
        "name": "Major, Alarte ascendare",
        "type": "Major",
        "categoria": "Feitiço",
        "acerto": 10,
        "dano": "1d4-3d4",
        "description": "Arremessa o alvo para longe 4m-6m (d6)"
      }
    ]
  },
  {
    "name": "Basilisco",
    "imageUrl": "Basilisco.jpg",
    "maxHp": 70,
    "size": 6,
    "esquiva": 1,
    "acuracia": 1,
    "deslocamento": "9 metros",
    "bonus": "+3 Força",
    "ataque": {
      "corte": 3,
      "feitico": 0,
      "impacto": 3,
      "elemental": 0,
      "potencial": 0,
      "magiaNegra": 0,
      "perfuracao": 4,
      "resistencia": 2
    },
    "defesa": {
      "corte": 3,
      "feitico": 2,
      "impacto": 2,
      "elemental": 1,
      "magiaNegra": 3,
      "perfuracao": 2
    },
    "local": "Lagos com temperaturas quentes.",
    "personalidade": "Selvagem.",
    "gostaNaoGosta": "Música, animais de médio porte. / Fogo, barulhos altos.",
    "partesUteis": "Pele, olhos, presas, ponta da cauda, glândulas de veneno.",
    "informacoes": "Os basiliscos vivem em locais com muita água ou alagados, são extremamente venenosos, a depender do local, o seu veneno pode ser mais forte ou mais fraco. Costumam viver sozinhas e quando se encontram, travam um combate mortal. São imunes ao próprio veneno, o qual é um produto valioso em alguns lugares. São carnívoros e comem qualquer animal que se aproxime de mais. Tem a capacidade de sentir vibrações na água para identificar a posição da presa. Sua reprodução ocorre durante o verão, quando são mais ativos. Medem por volta de 6 metros e pesam 200kg.",
    "habitos": "Fica sempre em locais alagados ou lagos, pois tem nervos na pele que detectam vibrações na água em até 300m. Permanece imóvel até sentir que alguém tocou a água, então desliza até a vítima e a morde com suas presas que inoculam um poderoso veneno. Se a vítima resistir muito, pode se enrolar nela para a matar por contrição. Em combate direto, pode usar a cauda, que possui uma ponta dura e afiada como uma lâmina, para atacar o inimigo. Se move rapidamente rodeando a vítima e tentando encontrar uma abertura para morder.",
    "acoes": [
      {
        "id": "basilisco_1",
        "name": "Major, Investida",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 8,
        "dano": "2d6",
        "description": "Chance de queda ao acerto se tirar abaixo de 40 no d100"
      },
      {
        "id": "basilisco_2",
        "name": "Major, Mordida",
        "type": "Major",
        "categoria": "Perfuração",
        "acerto": 10,
        "dano": "2d8",
        "description": "Veneno potente se tirar menos que 80 no d100: 3 de dano por turno."
      },
      {
        "id": "basilisco_3",
        "name": "Minor, Golpe de cauda",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 8,
        "dano": "d12",
        "description": ""
      }
    ]
  },
  {
    "name": "Corredor",
    "imageUrl": "Corredor.jpg",
    "maxHp": 35,
    "size": 2.2,
    "esquiva": 2,
    "acuracia": 2,
    "deslocamento": "8 metros",
    "bonus": "+2 Força",
    "ataque": {
      "corte": 3,
      "feitico": 0,
      "impacto": 4,
      "elemental": 0,
      "potencial": 0,
      "magiaNegra": 0,
      "perfuracao": 2,
      "resistencia": 1
    },
    "defesa": {
      "corte": 3,
      "feitico": 2,
      "impacto": 2,
      "elemental": 2,
      "magiaNegra": 1,
      "perfuracao": 2
    },
    "local": "Florestas de Goundospauh.",
    "personalidade": "Selvagem.",
    "gostaNaoGosta": "",
    "partesUteis": "Ossos, garras.",
    "informacoes": "Incrível agilidade. Caçador incomparável. Pernas fortes (capaz de rasgar um adulto). Não muito resistente. Caça em grupos de 3-4. 2,20m de altura. Hábitos noturnos.",
    "habitos": "",
    "acoes": [
      {
        "id": "corr_1",
        "name": "1-4 Garras",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 10,
        "dano": "d8",
        "description": "sangramento -30: 1 dano turno."
      },
      {
        "id": "corr_2",
        "name": "5-10 Chute circular",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 10,
        "dano": "2d6",
        "description": "quebra ossos -50 / derrubar"
      },
      {
        "id": "corr_3",
        "name": "11-12 Chute no peito",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 12,
        "dano": "d12",
        "description": "derrubar -70"
      }
    ]
  },
  {
    "name": "Demônio de Fogo, Ignis homo",
    "imageUrl": "demonio de fogo.jpg",
    "maxHp": 50,
    "size": 1.7,
    "esquiva": 1,
    "acuracia": 2,
    "deslocamento": "4 metros",
    "bonus": "",
    "ataque": {
      "corte": 4,
      "feitico": 0,
      "impacto": 2,
      "elemental": 4,
      "potencial": 0,
      "magiaNegra": 0,
      "perfuracao": 4,
      "resistencia": 1
    },
    "defesa": {
      "corte": 2,
      "feitico": 2,
      "impacto": 1,
      "elemental": 4,
      "magiaNegra": 1,
      "perfuracao": 1
    },
    "local": "Florestas densas de Goundospauh.",
    "personalidade": "Selvagem",
    "gostaNaoGosta": "",
    "partesUteis": "Ossos, chifre.",
    "informacoes": "Ignis Homo ou demônio de fogo como é conhecido, vive nas florestas densas de Goundospauh, normalmente dentro de cavernas profundas com acesso a lava vulcânica, onde eles se desenvolvem e se reproduzem. Muito se discute se é um demônio morto vivo ou não, mas é certo de que têm forte magia elemental. Tendo por volta de 1,70m e pesando 60kg, o demônio de fogo é agil, mas prefere um combate estratégico, mantendo o que lhe ameaça longe e acertando ataques a distância. Não se sabe a sua alimentação, alguns teorizam que ele se alimenta de rochas vulcânicas, mas ninguém nunca o viu se alimentando. Após a morte, seu corpo esfria e se torna opaco e quebradiço. Sua reprodução acontece por volta da primavera, logo após o final do inverno.",
    "habitos": "",
    "acoes": [
      {
        "id": "ignis_1",
        "name": "1-4 Perfuração com garra",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 10,
        "dano": "2d4 + 2 de fogo",
        "description": "Queimadura -40"
      },
      {
        "id": "ignis_2",
        "name": "5-10 Lança chamas",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 6,
        "dano": "2d6 + 3 fogo",
        "description": "6 acerto 1 metro, 8 acerto 2 metros / Queimadura -50"
      },
      {
        "id": "ignis_3",
        "name": "11-15 Supernova",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 0,
        "dano": "1d6/turno",
        "description": "Esquenta a área ao redor, queimando tudo que estiver a menos de 2 metros de distância, causando 1d6 de dano por turno. De 3 a 4 metros se recebe 1 de dano."
      },
      {
        "id": "ignis_4",
        "name": "16-18 Bola de fogo",
        "type": "Minor",
        "categoria": "Elemental",
        "acerto": 8,
        "dano": "1d8 + 3 de fogo",
        "description": "Queimadura -30"
      },
      {
        "id": "ignis_5",
        "name": "19-20 Vômito de lava",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 8,
        "dano": "2d6 por turno",
        "description": "Vomita lava ao redor de 2 metros, que queima por 3 turnos, 2d6 por turno se estiver em cima, se receber o ataque em cheio, 2d6 + 4 de fogo / 8 acerto / Queimadura -60"
      }
    ]
  },
  {
    "name": "Fênix",
    "imageUrl": "Fênix.jpg",
    "maxHp": 30,
    "size": 1.4,
    "esquiva": 3,
    "acuracia": 3,
    "deslocamento": "8 metros",
    "bonus": "+3 Destreza",
    "ataque": {
      "corte": 2,
      "feitico": 5,
      "impacto": 1,
      "elemental": 5,
      "potencial": 2,
      "magiaNegra": 5,
      "perfuracao": 1,
      "resistencia": 1
    },
    "defesa": {
      "corte": 0,
      "feitico": 7,
      "impacto": 0,
      "elemental": 7,
      "magiaNegra": 7,
      "perfuracao": 0
    },
    "local": "Montanhas de Windhollow.",
    "personalidade": "Indomável.",
    "gostaNaoGosta": "",
    "partesUteis": "Penas, última pena, lágrimas.",
    "informacoes": "As feníces são conhecidas por sua maior e mais abominada habilidade: ressuscitar das cinzas quando morrem. Apesar de uma característica incrível, alguns acreditam ser um sacrilégio e magia negra. Suas lágrimas possuem a capacidade de curar qualquer ferimento, doença e veneno, por isso é chamada de elixir da vida, apesar de ninguém saber se elas poderiam dar a imortalidade a alguém. Retirar lágrimas de um fenix é uma tarefa praticamente impossível, embora pessoas já conseguiram esse feito, e essas são as pessoas que descobriram suas propriedades. Durante a primavera as feníces migram para algum lugar escondido onde acasalam, muitos procuram até hoje esse local, mas nenhum chegou perto. A sua alimentação consiste em frutas e pequenos animais, e vivem na maior parte de suas vidas sozinhas, até acharem um parceiro na maturidade, e eles permanecem juntos até o fim da vida de um deles, quando o ciclo de sua vida se reinicia. Podem medir até 1,40m de envergadura de uma asa a outra e são bem fortes, podendo carregar um grande peso em voo, apesar de seu peso não passar dos 10kg. Suas penas são muito estimadas para os criadores de varinhas, especialmente a última pena que sobra quando das suas cinzas quando ela morre.",
    "habitos": "",
    "acoes": [
      {
        "id": "phoenix_1",
        "name": "Circle Flamarien",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 10,
        "dano": "1d6/turno",
        "description": "Dura por 3 turnos. Conjura um anel de fogo em torno da criatura. Causa dano a quem se aproximar."
      },
      {
        "id": "phoenix_2",
        "name": "Diffindo Incendio",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 10,
        "dano": "2d4",
        "description": "Conjura um corte de fogo."
      },
      {
        "id": "phoenix_3",
        "name": "Ignis tempestas",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 10,
        "dano": "2d6",
        "description": "Em área de 10 metros ao redor. Conjura uma tempestade de fogo. Queimadura +2."
      },
      {
        "id": "phoenix_4",
        "name": "Incendio Tria",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 8,
        "dano": "1d4+1d6",
        "description": "Um fogo três vezes mais quente do que o feitiço Incendio. Queimadura +2."
      },
      {
        "id": "phoenix_5",
        "name": "Pyrosphefera",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 8,
        "dano": "2d4",
        "description": "Em área 2x2. Conjura uma bola de fogo. Queimadura +2."
      },
      {
        "id": "phoenix_6",
        "name": "Scarlatum Duo",
        "type": "Major",
        "categoria": "Feitiço",
        "acerto": 6,
        "dano": "1d8+2",
        "description": "2 de dano vezes o resultado. Área de 3 metros em meia lua a frente. Impede aproximação jogando para trás."
      }
    ]
  },
  {
    "name": "Jackalope",
    "imageUrl": "Jackalope.jpg",
    "maxHp": 6,
    "size": 0.4,
    "esquiva": 3,
    "acuracia": 2,
    "deslocamento": "6 metros",
    "bonus": "+3 percepção",
    "ataque": {
      "corte": 1,
      "feitico": 1,
      "impacto": 0,
      "elemental": 1,
      "potencial": 0,
      "magiaNegra": 1,
      "perfuracao": 1,
      "resistencia": 0
    },
    "defesa": {
      "corte": 0,
      "feitico": 0,
      "impacto": 0,
      "elemental": 0,
      "magiaNegra": 0,
      "perfuracao": 0
    },
    "local": "Florestas em geral.",
    "personalidade": "Dócil.",
    "gostaNaoGosta": "",
    "partesUteis": "Carne, pele, chifres.",
    "informacoes": "Vive nas florestas com climas agradáveis e quentes, parecidos com coelhos, porém maiores e com galhadas. São rápidos e bem ágeis, costumam fugir quando ameaçados. Carne apreciada e fácil de cozinhar. Reprodução rápida.",
    "habitos": "",
    "acoes": [
      {
        "id": "jack_1",
        "name": "Chifrada",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 8,
        "dano": "d4",
        "description": ""
      }
    ]
  },
  {
    "name": "Moder",
    "imageUrl": "Moder.jpeg",
    "maxHp": 150,
    "size": 2,
    "esquiva": 4,
    "acuracia": 3,
    "deslocamento": "10 metros",
    "bonus": "+4 força, +3 furtividade, +20 resistência e adaptabilidade.",
    "ataque": {
      "corte": 2,
      "feitico": 0,
      "impacto": 4,
      "elemental": 0,
      "potencial": 0,
      "magiaNegra": 0,
      "perfuracao": 3,
      "resistencia": 1
    },
    "defesa": {
      "corte": 6,
      "feitico": 6,
      "impacto": 7,
      "elemental": 7,
      "magiaNegra": 9,
      "perfuracao": 5
    },
    "local": "Windhollow.",
    "personalidade": "Indomável.",
    "gostaNaoGosta": "",
    "partesUteis": "Chifres, pele, fibra de coração.",
    "informacoes": "",
    "habitos": "Controla outras criaturas para se proteger e caçar por ele, tem o costume de pendurar suas presas nas árvores para \"estocar alimento\". Usa de magia negra para enlouquecer a vítima ou a deixar com medo, enfraquecendo sua mente para controlar ela. ",
    "acoes": [
      {
        "id": "u3x8p68w6p",
        "name": "Accio",
        "type": "Minor",
        "categoria": "Feitiço",
        "acerto": 8,
        "dano": "0",
        "description": "Accio, feitiço, intermediário: Atrai o objeto desejado em uma área de até 10 metros, exceto coisas mais pesadas que 5kg e seres vivos."
      },
      {
        "id": "rqohv9wa30",
        "name": "Sectum sempra",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 12,
        "dano": "2d8+2",
        "description": "Sectumsempra, magia negra, avançado: Produz cortes profundos no oponente. sangramento de nível 2."
      },
      {
        "id": "0awq03ebog",
        "name": "Cruciatus",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 12,
        "dano": "1d4",
        "description": " Causa uma dor insuportável no corpo da vítima, que não consegue se mover ou fazer qualquer outra coisa. A maldição usa 1 minor action por turno para se manter funcionando e enquanto estiver ativa, sempre que o conjurador sofrer dano, ele irá rolar um dado de inteligência para se manter focado na magia.  1d8 de dano na sanidade por turno + 1d4 de dano por turno.\n"
      },
      {
        "id": "al4tc4bqtz",
        "name": "Legilimens",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 12,
        "dano": "0",
        "description": "Usado para penetrar e ler a mente de outra pessoa. Pode ser evitado pela Oclumencia.\n\n"
      },
      {
        "id": "kjief65xz1",
        "name": "Inferum Panicum",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 16,
        "dano": "0",
        "description": "magia negra, intermediário: Faz a vítima ter medo do usuário, não conseguindo atacar e tentando fugir."
      },
      {
        "id": "ampwpjposf",
        "name": "Confundus",
        "type": "Major",
        "categoria": "Outro",
        "acerto": 12,
        "dano": "",
        "description": "magia negra, básico: Confunde a vítima, que tem -4 na acurácia e -3 na esquiva por 3 turnos."
      },
      {
        "id": "blokwkm6kx",
        "name": "Desipien",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 14,
        "dano": "0",
        "description": "magia negra, avançado: Faz a vítima alucinar coisas a escolha do bruxo. O efeito varia da alucinação, mas pode fazer a vitima perder sanidade, ter medo, baixar a guarda para um ataque, etc..."
      },
      {
        "id": "5gsw0l6nw5",
        "name": "Chifrada",
        "type": "Major",
        "categoria": "Outro",
        "acerto": 14,
        "dano": "3d6",
        "description": "Avança com os chifres contra o alvo, dando uma chifrada devastadora."
      },
      {
        "id": "8ud2yknyo6",
        "name": "Imperius",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 12,
        "dano": "0",
        "description": "magia negra, mestre: Faz com que a vítima seja controlada pelo bruxo que lançou o feitiço. (10 mana, pode ser resistido se tirar mais de 75 no d100 de sanidade que é rolado a cada turno)"
      }
    ]
  },
  {
    "name": "Noctua Luna",
    "imageUrl": "noctua luna.jpg",
    "maxHp": 20,
    "size": 1.7,
    "esquiva": 3,
    "acuracia": 2,
    "deslocamento": "3-10 metros",
    "bonus": "+3 percepção",
    "ataque": {
      "corte": 3,
      "feitico": 0,
      "impacto": 2,
      "elemental": 0,
      "potencial": 1,
      "magiaNegra": 2,
      "perfuracao": 3,
      "resistencia": 1
    },
    "defesa": {
      "corte": 0,
      "feitico": 0,
      "impacto": 0,
      "elemental": 0,
      "magiaNegra": 2,
      "perfuracao": 0
    },
    "local": "Linha de Delgoin.",
    "personalidade": "Moderado",
    "gostaNaoGosta": "",
    "partesUteis": "Galhadas, sangue, penas, asas.",
    "informacoes": "Dito trazer mal agouro. 1,70m de altura e 3m de envergadura. Come animais pequenos. Sangue pode ter propriedades mágicas. Acasalamento no outono.",
    "habitos": "",
    "acoes": [
      {
        "id": "noctua_1",
        "name": "1-5 Arranhão",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 10,
        "dano": "2d6",
        "description": ""
      },
      {
        "id": "noctua_2",
        "name": "6-11 Investida",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 12,
        "dano": "1d8",
        "description": ""
      },
      {
        "id": "noctua_3",
        "name": "12-14 Agouro",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 10,
        "dano": "-",
        "description": "Má sorte -70: -1 em todas as ações por 2 dias."
      },
      {
        "id": "noctua_4",
        "name": "15-19 Galhada",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 12,
        "dano": "2d8",
        "description": ""
      },
      {
        "id": "noctua_5",
        "name": "18-20 Agarrar",
        "type": "Major",
        "categoria": "Perfuração",
        "acerto": 14,
        "dano": "3d4",
        "description": "Voa com a vítima e solta do alto. 3 metros por turno."
      }
    ]
  },
  {
    "name": "Púca ou Phooka",
    "imageUrl": "Phooka.png",
    "maxHp": 15,
    "size": 0.7,
    "esquiva": 3,
    "acuracia": 2,
    "deslocamento": "6 metros",
    "bonus": "+2 Enganação",
    "ataque": {
      "corte": 1,
      "feitico": 3,
      "impacto": 2,
      "elemental": 0,
      "potencial": 2,
      "magiaNegra": 0,
      "perfuracao": 1,
      "resistencia": 0
    },
    "defesa": {
      "corte": 0,
      "feitico": 4,
      "impacto": 0,
      "elemental": 2,
      "magiaNegra": 2,
      "perfuracao": 0
    },
    "local": "Florestas de Goundospauh.",
    "personalidade": "Dócil.",
    "gostaNaoGosta": "",
    "partesUteis": "Carne, asas.",
    "informacoes": "Phooka ou Púca, é um demônio onívoro que gosta de enganar viajantes para os levar a situações perigosas e mortais, caso seu plano dê certo, ele come a carne da vítima, ele engana as pessoas dando frutas e pedras preciosas para chamar sua atenção, prometendo levar os viajantes até a fonte do item, as vezes, em noites escuras, ele cria uma chama em sua mão que ilumina a escuridão da floresta, chamando a atenção de quem passa, ele guia a pessoa perdida pela floresta com sua luz e a leva para sua armadilha. Mede por volta de 70 cm e pesa 10kg. São presas para os Baku e Corredores. Sua reprodução ocorre a partir de 1 ano de vida, especialmente durante o inverno.",
    "habitos": "",
    "acoes": [
      {
        "id": "phooka_1",
        "name": "1-5 Garras",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 8,
        "dano": "d4",
        "description": "Sangramento -20"
      },
      {
        "id": "phooka_2",
        "name": "6-9 Mordida",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 8,
        "dano": "d6",
        "description": "Sangramento -30"
      },
      {
        "id": "phooka_3",
        "name": "10-12 Chama pequena",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 10,
        "dano": "2d4",
        "description": "Queimar -1, Queimadura -20, 3 dano."
      },
      {
        "id": "phooka_4",
        "name": "Carpe Retractum",
        "type": "Major",
        "categoria": "Feitiço",
        "acerto": 12,
        "dano": "-",
        "description": "Cria uma corda de luz que puxa objetos até ele."
      }
    ]
  },
  {
    "name": "Rapinomônio (Borboleta Fantasma)",
    "imageUrl": "rapinomonio.jpg",
    "maxHp": 30,
    "size": 0.8,
    "esquiva": 4,
    "acuracia": 2,
    "deslocamento": "10 metros",
    "bonus": "Reflete feitiços (resultado 1 no d8)",
    "ataque": {
      "corte": 0,
      "feitico": 5,
      "impacto": 3,
      "elemental": 4,
      "potencial": 2,
      "magiaNegra": 3,
      "perfuracao": 4,
      "resistencia": 1
    },
    "defesa": {
      "corte": 4,
      "feitico": 5,
      "impacto": 2,
      "elemental": 1,
      "magiaNegra": 2,
      "perfuracao": 3
    },
    "local": "Linha de Delgoin, Clearhollow e MarbleEdge",
    "personalidade": "Dócil",
    "gostaNaoGosta": "",
    "partesUteis": "Pele, veneno, crisálida.",
    "informacoes": "Confundido com casulo de mariposa. Dieta de cérebros. 2m de envergadura. Veneno desnorteia e paralisa. Se enrola nas asas para descansar.",
    "habitos": "",
    "acoes": [
      {
        "id": "rapi_1",
        "name": "Mordida",
        "type": "Major",
        "categoria": "Perfuração",
        "acerto": 12,
        "dano": "2d6+1d4",
        "description": "Sangramento -60, Veneno -50, Paralisia 3 turnos."
      },
      {
        "id": "rapi_2",
        "name": "Sectumsempra",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 12,
        "dano": "2d8",
        "description": "Sangramento nível 2 instantâneo."
      },
      {
        "id": "rapi_3",
        "name": "Locomotor mortis",
        "type": "Minor",
        "categoria": "Feitiço",
        "acerto": 10,
        "dano": "-",
        "description": "Prende pernas. Alvo perde esquiva e metade do deslocamento (2 turnos)."
      },
      {
        "id": "rapi_4",
        "name": "Investida de espinhos",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 14,
        "dano": "3d6",
        "description": "Quebra ossos -30, Hemorragia -30."
      }
    ]
  },
  {
    "name": "Skinwalker",
    "imageUrl": "SkinWalker.jpeg",
    "maxHp": 40,
    "size": 1.5,
    "esquiva": 3,
    "acuracia": 2,
    "deslocamento": "7 metros",
    "bonus": "Percepção +3, força +2",
    "ataque": {
      "corte": 3,
      "feitico": 8,
      "impacto": 2,
      "elemental": 8,
      "potencial": 2,
      "magiaNegra": 6,
      "perfuracao": 4,
      "resistencia": 1
    },
    "defesa": {
      "corte": 3,
      "feitico": 6,
      "impacto": 3,
      "elemental": 5,
      "magiaNegra": 7,
      "perfuracao": 2
    },
    "local": "Toda Mauer.",
    "personalidade": "???",
    "gostaNaoGosta": "",
    "partesUteis": "Núcleo do coração.",
    "informacoes": "Uma criatura medonha e extremamente ágil que usa magia negra, feitiços e ataques físicos brutais. Habita em Toda Mauer.",
    "habitos": "",
    "acoes": [
      {
        "id": "skin_1",
        "name": "1-3 Mordida desesperada",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 8,
        "dano": "d4",
        "description": "Ataca 5 vezes / sangramento -70"
      },
      {
        "id": "skin_2",
        "name": "4-6 Arranhar",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 10,
        "dano": "2d6",
        "description": "sangramento -70"
      },
      {
        "id": "skin_3",
        "name": "7-9 Agarrar",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 8,
        "dano": "-",
        "description": "agarra o alvo / 8 acerto"
      },
      {
        "id": "skin_4",
        "name": "10-11 Bombarda, elemental",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 8,
        "dano": "2d8",
        "description": "Causa uma explosão 2x2m em até 8 metros de distância. Dano em área."
      },
      {
        "id": "skin_5",
        "name": "12-13 Circus Infalamre, elemental",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 8,
        "dano": "-",
        "description": "Conjura um círculo de fogo numa área de 10 metros, pode ser conjurado com o mago no canto do círculo."
      },
      {
        "id": "skin_6",
        "name": "14-16 Erracto Córtex, magia negra",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 10,
        "dano": "3d6",
        "description": "A pessoa tem a ilusão de ter tido um corte fundo no braço, com um forte sangramento."
      },
      {
        "id": "skin_7",
        "name": "17-20 Flipendo, feitiço",
        "type": "Minor",
        "categoria": "Feitiço",
        "acerto": 10,
        "dano": "2d4",
        "description": "Usado para atingir o inimigo, causando muita dor. Pode derrubar -40"
      },
      {
        "id": "skin_8",
        "name": "Oscausi, magia negra",
        "type": "Major",
        "categoria": "Magia Negra",
        "acerto": 8,
        "dano": "-",
        "description": "Sela a boca de alguém."
      }
    ]
  },
  {
    "name": "Tobi Kadachi",
    "imageUrl": "Tobi Kadachi.jpg",
    "maxHp": 40,
    "size": 1.6,
    "esquiva": 2,
    "acuracia": 2,
    "deslocamento": "5-10 metros",
    "bonus": "+2 Percepção",
    "ataque": {
      "corte": 3,
      "feitico": 0,
      "impacto": 2,
      "elemental": 4,
      "potencial": 2,
      "magiaNegra": 0,
      "perfuracao": 2,
      "resistencia": 2
    },
    "defesa": {
      "corte": 2,
      "feitico": 0,
      "impacto": 2,
      "elemental": 3,
      "magiaNegra": 0,
      "perfuracao": 2
    },
    "local": "Florestas de Windhollow.",
    "personalidade": "Moderado.",
    "gostaNaoGosta": "",
    "partesUteis": "Pele, carne, pelo.",
    "informacoes": "Produz eletricidade e dispara raios. Possui membranas para planar. 70kg e 1,60m. Onívoro (frutas/pequenos animais). Fugaz mas agressivo com filhotes.",
    "habitos": "",
    "acoes": [
      {
        "id": "tobi_1",
        "name": "1-2 Mordida",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 10,
        "dano": "1d12",
        "description": "Sangramento -20"
      },
      {
        "id": "tobi_2",
        "name": "3-6 Raio",
        "type": "Minor",
        "categoria": "Elemental",
        "acerto": 10,
        "dano": "3d4",
        "description": "Paralisar -40: 2 turnos"
      },
      {
        "id": "tobi_3",
        "name": "6-8 Golpe de cauda",
        "type": "Minor",
        "categoria": "Impacto",
        "acerto": 8,
        "dano": "1d8",
        "description": "Quebrar ossos -30"
      },
      {
        "id": "tobi_4",
        "name": "9-10 Garras",
        "type": "Minor",
        "categoria": "Corte",
        "acerto": 8,
        "dano": "2d4",
        "description": "Sangramento -30"
      },
      {
        "id": "tobi_5",
        "name": "11-12 Eletrocutar",
        "type": "Major",
        "categoria": "Elemental",
        "acerto": 14,
        "dano": "4d4",
        "description": "Paralisar -60: 2 turnos ; Quebra ossos -30"
      }
    ]
  },
  {
    "name": "Volans Anguis, a Serpente dos Ares",
    "imageUrl": "Volans anguis.png",
    "maxHp": 45,
    "size": 7,
    "esquiva": 1,
    "acuracia": 2,
    "deslocamento": "5 metros",
    "bonus": "+4 Força",
    "ataque": {
      "corte": 0,
      "feitico": 0,
      "impacto": 3,
      "elemental": 0,
      "potencial": 0,
      "magiaNegra": 0,
      "perfuracao": 4,
      "resistencia": 2
    },
    "defesa": {
      "corte": 2,
      "feitico": 3,
      "impacto": 2,
      "elemental": 0,
      "magiaNegra": 0,
      "perfuracao": 2
    },
    "local": "Windhollow.",
    "personalidade": "Selvagem.",
    "gostaNaoGosta": "",
    "partesUteis": "Pele, presas, penas.",
    "informacoes": "Vivem nas partes mais quentes das florestas de Windhollow e Goundospauh, medem em torno de 7 metros e pesam em média 150kg. Não usam muito suas asas, muitos até dizem que não podem voar, mas outros afirmam que já viram Volans voando pelos céus, a única certeza é que elas conseguem planar por entre as árvores, habilidade que usam para caçar. São carnívoras e comem animais e humanos inteiros com facilidade após quebrarem seus ossos os apertando com seu grande corpo. Seu período de acasalamento é durante os primeiros dias de inverno, quando permanecem escondidas em suas tocas, logo antes do período de brumação. Suas penas e pele têm um grande valor de venda, são usadas em decoração e alguns rituais locais.",
    "habitos": "",
    "acoes": [
      {
        "id": "volans_1",
        "name": "1-5 Mordida",
        "type": "Minor",
        "categoria": "Perfuração",
        "acerto": 10,
        "dano": "2d6",
        "description": "Sangramento -30"
      },
      {
        "id": "volans_2",
        "name": "6-9 Aperto",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 12,
        "dano": "1d4/turno",
        "description": "Aumenta em 1d4 a cada turno. Quebra ossos -70, diminui em 10 a cada turno. Digerir: 1d4 turno."
      },
      {
        "id": "volans_3",
        "name": "10-12 Investida",
        "type": "Major",
        "categoria": "Impacto",
        "acerto": 10,
        "dano": "1d8",
        "description": "Quebra ossos -20"
      }
    ]
  }
];
