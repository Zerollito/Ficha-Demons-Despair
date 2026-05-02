import { BestiaryMonster } from "../types";

export const DEFAULT_MONSTERS: Omit<BestiaryMonster, 'masterId' | 'id'>[] = [
  {
    name: "Basilisco",
    maxHp: 60,
    size: 6,
    esquiva: 0,
    acuracia: 1,
    deslocamento: "5 metros",
    bonus: "+3 Força",
    ataque: { corte: 3, perfuracao: 4, impacto: 3, resistencia: 2, feitico: 0, elemental: 0, magiaNegra: 0, potencial: 0 },
    defesa: { corte: 3, perfuracao: 2, impacto: 2, feitico: 2, elemental: 1, magiaNegra: 3 },
    local: "Lagos com temperaturas quentes.",
    personalidade: "Selvagem.",
    gostaNaoGosta: "Música, animais de médio porte. / Fogo, barulhos altos.",
    partesUteis: "Pele, olhos, presas, ponta da cauda, glândulas de veneno.",
    informacoes: "Os basiliscos vivem em locais com muita água ou alagados, são extremamente venenosos, a depender do local, o seu veneno pode ser mais forte ou mais fraco. Costumam viver sozinhas e quando se encontram, travam um combate mortal. São imunes ao próprio veneno, o qual é um produto valioso em alguns lugares. São carnívoros e comem qualquer animal que se aproxime de mais. Tem a capacidade de sentir vibrações na água para identificar a posição da presa. Sua reprodução ocorre durante o verão, quando são mais ativos. Medem por volta de 6 metros e pesam 200kg.",
    habitos: "Fica sempre em locais alagados ou lagos, pois tem nervos na pele que detectam vibrações na água em até 300m. Permanece imóvel até sentir que alguém tocou a água, então desliza até a vítima e a morde com suas presas que inoculam um poderoso veneno. Se a vítima resistir muito, pode se enrolar nela para a matar por contrição. Em combate direto, pode usar a cauda, que possui uma ponta dura e afiada como uma lâmina, para atacar o inimigo. Se move rapidamente rodeando a vítima e tentando encontrar uma abertura para morder.",
    acoes: [
      { id: "basilisco_1", name: "Investida", type: "Major", categoria: "Impacto", acerto: 8, dano: "2d6", description: "Chance de queda ao acerto se tirar abaixo de 40 no d100" },
      { id: "basilisco_2", name: "Mordida", type: "Major", categoria: "Perfuração", acerto: 10, dano: "2d8", description: "Veneno potente (3 de dano por turno) se tirar menos que 80 no d100" },
      { id: "basilisco_3", name: "Golpe de cauda", type: "Minor", categoria: "Corte", acerto: 8, dano: "d12", description: "" }
    ]
  },
  {
    name: "Demônio de Fogo (Ignis homo)",
    maxHp: 40,
    size: 1.7,
    esquiva: 1,
    acuracia: 2,
    deslocamento: "4 metros",
    bonus: "",
    ataque: { corte: 4, perfuracao: 4, impacto: 2, resistencia: 1, feitico: 0, elemental: 4, magiaNegra: 0, potencial: 0 },
    defesa: { corte: 2, perfuracao: 1, impacto: 1, feitico: 2, elemental: 4, magiaNegra: 1 },
    local: "Florestas densas de Goundospauh.",
    personalidade: "Selvagem",
    partesUteis: "Ossos, chifre.",
    informacoes: "Ignis Homo ou demônio de fogo como é conhecido, vive nas florestas densas de Goundospauh, normalmente dentro de cavernas profundas com acesso a lava vulcânica, onde eles se desenvolvem e se reproduzem. Muito se discute se é um demônio morto vivo ou não, mas é certo de que têm forte magia elemental. Tendo por volta de 1,70m e pesando 60kg, o demônio de fogo é agil, mas prefere um combate estratégico, mantendo o que lhe ameaça longe e acertando ataques a distância. Não se sabe a sua alimentação, alguns teorizam que ele se alimenta de rochas vulcânicas, mas ninguém nunca o viu se alimentando. Após a morte, seu corpo esfria e se torna opaco e quebradiço. Sua reprodução acontece por volta da primavera, logo após o final do inverno.",
    acoes: [
      { id: "ignis_1", name: "Perfuração com garra", type: "Minor", categoria: "Perfuração", acerto: 10, dano: "2d4+2 fogo", description: "Queimadura -40" },
      { id: "ignis_2", name: "Lança chamas", type: "Major", categoria: "Elemental", acerto: 8, dano: "2d6+3 fogo", description: "Queimadura -50. Acerto 6 p/ 1m" },
      { id: "ignis_3", name: "Supernova", type: "Major", categoria: "Elemental", acerto: 0, dano: "1d6/turno", description: "Queima tudo a menos de 2m. 3-4m recebe 1 dano." },
      { id: "ignis_4", name: "Bola de fogo", type: "Minor", categoria: "Elemental", acerto: 8, dano: "1d8+3 fogo", description: "Queimadura -30" },
      { id: "ignis_5", name: "Vômito de lava", type: "Major", categoria: "Elemental", acerto: 8, dano: "2d6+4 fogo", description: "Queimadura -60. Queima por 3 turnos (2d6/turno se em cima)" }
    ]
  },
  {
    name: "Jackalope",
    maxHp: 6,
    size: 0.4,
    esquiva: 3,
    acuracia: 2,
    deslocamento: "6 metros",
    bonus: "+3 percepção",
    ataque: { corte: 1, perfuracao: 1, impacto: 0, resistencia: 0, feitico: 1, elemental: 1, magiaNegra: 1, potencial: 0 },
    defesa: { corte: 0, perfuracao: 0, impacto: 0, feitico: 0, elemental: 0, magiaNegra: 0 },
    local: "Florestas em geral.",
    personalidade: "Dócil.",
    partesUteis: "Carne, pele, chifres.",
    informacoes: "Vive nas florestas com climas agradáveis e quentes, parecidos com coelhos, porém maiores e com galhadas. São rápidos e bem ágeis, costumam fugir quando ameaçados. Carne apreciada e fácil de cozinhar. Reprodução rápida.",
    acoes: [
      { id: "jack_1", name: "Chifrada", type: "Minor", categoria: "Perfuração", acerto: 8, dano: "d4", description: "" }
    ]
  },
  {
    name: "Noctua Luna",
    maxHp: 15,
    size: 1.7,
    esquiva: 3,
    acuracia: 2,
    deslocamento: "3-10 metros",
    bonus: "+3 percepção",
    ataque: { corte: 3, perfuracao: 3, impacto: 2, resistencia: 1, feitico: 0, elemental: 0, magiaNegra: 2, potencial: 1 },
    defesa: { corte: 0, perfuracao: 0, impacto: 0, feitico: 0, elemental: 0, magiaNegra: 2 },
    local: "Linha de Delgoin.",
    personalidade: "Moderado",
    partesUteis: "Galhadas, sangue, penas, asas.",
    informacoes: "Dito trazer mal agouro. 1,70m de altura e 3m de envergadura. Come animais pequenos. Sangue pode ter propriedades mágicas. Acasalamento no outono.",
    acoes: [
      { id: "noctua_1", name: "Arranhão", type: "Minor", categoria: "Corte", acerto: 10, dano: "2d6", description: "" },
      { id: "noctua_2", name: "Investida", type: "Major", categoria: "Impacto", acerto: 12, dano: "1d8", description: "" },
      { id: "noctua_3", name: "Agouro", type: "Major", categoria: "Magia Negra", acerto: 10, dano: "-", description: "Má sorte -70: -1 em todas as ações por 2 dias." },
      { id: "noctua_4", name: "Galhada", type: "Minor", categoria: "Perfuração", acerto: 12, dano: "2d8", description: "" },
      { id: "noctua_5", name: "Agarrar", type: "Major", categoria: "Perfuração", acerto: 14, dano: "3d4", description: "Voo: Solta do alto. Move 3m/turno." }
    ]
  },
  {
    name: "Rapinomônio (Borboleta Fantasma)",
    maxHp: 30,
    size: 0.8,
    esquiva: 4,
    acuracia: 2,
    deslocamento: "10 metros",
    bonus: "Reflete feitiços (resultado 1 no d8)",
    ataque: { corte: 0, perfuracao: 4, impacto: 3, resistencia: 1, feitico: 5, elemental: 4, magiaNegra: 3, potencial: 2 },
    defesa: { corte: 4, perfuracao: 3, impacto: 2, feitico: 5, elemental: 1, magiaNegra: 2 },
    local: "Linha de Delgoin, Clearhollow e MarbleEdge",
    personalidade: "Dócil",
    partesUteis: "Pele, veneno, crisálida.",
    informacoes: "Confundido com casulo de mariposa. Dieta de cérebros. 2m de envergadura. Veneno desnorteia e paralisa. Se enrola nas asas para descansar.",
    acoes: [
      { id: "rapi_1", name: "Mordida", type: "Major", categoria: "Perfuração", acerto: 12, dano: "2d6+1d4", description: "Sangramento -60, Veneno -50, Paralisia 3 turnos." },
      { id: "rapi_2", name: "Sectumsempra", type: "Major", categoria: "Magia Negra", acerto: 12, dano: "2d8", description: "Sangramento nível 2 instantâneo." },
      { id: "rapi_3", name: "Locomotor mortis", type: "Minor", categoria: "Feitiço", acerto: 10, dano: "-", description: "Prende pernas. Alvo perde esquiva e metade do deslocamento (2 turnos)." },
      { id: "rapi_4", name: "Investida de espinhos", type: "Major", categoria: "Impacto", acerto: 14, dano: "3d6", description: "Quebra ossos -30, Hemorragia -30." }
    ]
  },
  {
    name: "Tobi Kadachi",
    maxHp: 30,
    size: 1.6,
    esquiva: 2,
    acuracia: 2,
    deslocamento: "5-10 metros",
    bonus: "+2 Percepção",
    ataque: { corte: 3, perfuracao: 2, impacto: 2, resistencia: 2, feitico: 0, elemental: 4, magiaNegra: 0, potencial: 2 },
    defesa: { corte: 2, perfuracao: 2, impacto: 2, feitico: 0, elemental: 3, magiaNegra: 0 },
    local: "Florestas de Windhollow.",
    personalidade: "Moderado.",
    partesUteis: "Pele, carne, pelo.",
    informacoes: "Produz eletricidade e dispara raios. Possui membranas para planar. 70kg e 1,60m. Onívoro (frutas/pequenos animais). Fugaz mas agressivo com filhotes.",
    acoes: [
      { id: "tobi_1", name: "Mordida", type: "Minor", categoria: "Perfuração", acerto: 10, dano: "1d12", description: "Sangramento -20" },
      { id: "tobi_2", name: "Raio", type: "Minor", categoria: "Elemental", acerto: 10, dano: "3d4", description: "Paralisar -40 (2 turnos)" },
      { id: "tobi_3", name: "Golpe de cauda", type: "Minor", categoria: "Impacto", acerto: 8, dano: "1d8", description: "Quebrar ossos -30" },
      { id: "tobi_4", name: "Garras", type: "Minor", categoria: "Corte", acerto: 8, dano: "2d4", description: "Sangramento -30" },
      { id: "tobi_5", name: "Eletrocutar", type: "Major", categoria: "Elemental", acerto: 14, dano: "4d4", description: "Paralisar -60 (2 turnos), Quebra ossos -30" }
    ]
  },
  {
    name: "Corredor",
    maxHp: 25,
    size: 2.2,
    esquiva: 2,
    acuracia: 2,
    deslocamento: "8 metros",
    bonus: "+2 Força",
    ataque: { corte: 3, perfuracao: 2, impacto: 4, resistencia: 1, feitico: 0, elemental: 0, magiaNegra: 0, potencial: 0 },
    defesa: { corte: 3, perfuracao: 2, impacto: 2, feitico: 2, elemental: 2, magiaNegra: 1 },
    local: "Florestas de Goundospauh.",
    personalidade: "Selvagem.",
    partesUteis: "Ossos, garras.",
    informacoes: "Incrível agilidade. Caçador incomparável. Pernas fortes (capaz de rasgar um adulto). Não muito resistente. Caça em grupos de 3-4. 2,20m de altura. Hábitos noturnos.",
    acoes: [
      { id: "corr_1", name: "Garras", type: "Minor", categoria: "Corte", acerto: 10, dano: "d8", description: "Sangramento -30 (1 dano turno)" },
      { id: "corr_2", name: "Chute circular", type: "Major", categoria: "Impacto", acerto: 10, dano: "2d6", description: "Quebra ossos -50, Derrubar" },
      { id: "corr_3", name: "Chute no peito", type: "Major", categoria: "Impacto", acerto: 12, dano: "d12", description: "Derrubar -70" }
    ]
  },
  {
    name: "Baku / Pã",
    maxHp: 20,
    size: 1,
    esquiva: 1,
    acuracia: 1,
    deslocamento: "5 metros",
    bonus: "+1 atletismo",
    ataque: { corte: 3, perfuracao: 3, impacto: 0, resistencia: 1, feitico: 2, elemental: 0, magiaNegra: 4, potencial: 1 },
    defesa: { corte: 1, perfuracao: 1, impacto: 1, feitico: 1, elemental: 1, magiaNegra: 4 },
    local: "Goundospauh",
    personalidade: "Moderado",
    gostaNaoGosta: "Carne. / Prata.",
    partesUteis: "Dentes.",
    informacoes: "Conhecido como Pã, deus das florestas. Faz vítimas desmaiarem e esquecerem as últimas horas. Semelhante a um lobo com crânio exposto. Carnívoro carniceiro.",
    habitos: "Usa magia negra para causar confusão. Atrai inimigos para lugares fechados para arremessar contra paredes.",
    acoes: [
      { id: "baku_1", name: "Colapso mental", type: "Major", categoria: "Magia Negra", acerto: 0, dano: "-", description: "Causa perda de memória e desmaio ao alvo. (-40)" },
      { id: "baku_2", name: "Golpe de garra", type: "Minor", categoria: "Corte", acerto: 10, dano: "2d4", description: "Putrefação -50, sangramento -70" },
      { id: "baku_3", name: "Mordida", type: "Minor", categoria: "Perfuração", acerto: 12, dano: "1d6", description: "Putrefação -50, sangramento -60" },
      { id: "baku_4", name: "Alarte ascendare", type: "Major", categoria: "Feitiço", acerto: 10, dano: "1d4-3d4", description: "Arremessa o alvo para longe 4m-6m (d6)" }
    ]
  }
];
