import { Character, ArmorPiece, Ability } from '../types';
import { generateId } from '../lib/random';

export interface EthnicityArmorPieceTemplate {
  nome: string;
  corte: number;
  impacto: number;
  perfuracao: number;
  durabilidade: number;
  peso: number;
  volume: number;
  reducaoDano: number;
  efeito?: string;
}

export interface EthnicityAbilityTemplate {
  nome: string;
  efeito: string;
}

export interface Ethnicity {
  id: string;
  name: string;
  description: string;
  proficienciasModifiers?: Record<string, number>;
  conhecimentosModifiers?: Record<string, number>;
  habilidades: EthnicityAbilityTemplate[];
  vestimentas?: EthnicityArmorPieceTemplate[];
}

export const ETHNICITIES: Ethnicity[] = [
  {
    id: 'custom',
    name: 'Customizado',
    description: 'Opção padrão livre de bônus ou debuffs automáticos. Permite ao jogador personalizar completamente sua cultura e histórico.',
    proficienciasModifiers: {},
    conhecimentosModifiers: {},
    habilidades: [],
    vestimentas: []
  },
  {
    id: 'goundospauh',
    name: 'Nativos de Goundospauh',
    description: 'Ágeis e habilidosos, os nativos de cor avermelhada se dão bem com armas artesanais, tendo um bônus de +1 ao tentar às criar, assim como um bônus de +1 no primeiro d8 de cansaço. (Nativos não são bem vistos em cidades grandes, nestas, recebem uma penalidade de -1 em comunicação).',
    proficienciasModifiers: {
      'Forja rústica': 1
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Armas Artesanais de Goundospauh',
        efeito: '+1 ao tentar criar armas artesanais.'
      },
      {
        nome: 'Vigor de Goundospauh',
        efeito: '+1 no primeiro d8 de cansaço.'
      },
      {
        nome: 'Estigma Urbano (Goundospauh)',
        efeito: 'Nativos não são bem vistos em cidades grandes: penalidade de -1 em Comunicação nestes locais.'
      }
    ],
    vestimentas: [
      { nome: 'Luvas (Veste de guerra)', corte: 1, impacto: 2, perfuracao: 1, durabilidade: 2, peso: 1, volume: 2, reducaoDano: 2 },
      { nome: 'Pernas (Veste de guerra)', corte: 1, impacto: 2, perfuracao: 1, durabilidade: 2, peso: 10, volume: 8, reducaoDano: 2 },
      { nome: 'Tronco (Veste de guerra)', corte: 1, impacto: 2, perfuracao: 1, durabilidade: 2, peso: 25, volume: 10, reducaoDano: 2 },
      { nome: 'Capacete (Veste de guerra)', corte: 1, impacto: 2, perfuracao: 1, durabilidade: 2, peso: 3, volume: 3, reducaoDano: 2 },
      { nome: 'Rebraço (Veste de guerra)', corte: 1, impacto: 2, perfuracao: 1, durabilidade: 2, peso: 5, volume: 6, reducaoDano: 2 },
      { nome: 'Botas (Veste de guerra)', corte: 1, impacto: 2, perfuracao: 1, durabilidade: 2, peso: 4, volume: 3, reducaoDano: 2 }
    ]
  },
  {
    id: 'lochcliff',
    name: 'Nativos de Lochcliff',
    description: 'Com pele parda, os nativos de Ivros são fortes e robustos, podendo utilizar bem armas pesadas e suportar bem a fome por conta das terras áridas, têm um bônus de +5 no primeiro d100 para fome e bônus de dano de força +2 (não entra na escala), assim como +1 em nível para climas quentes. (Nativos não são bem vistos em cidades grandes, nestas, recebem uma penalidade de -1 em comunicação).',
    proficienciasModifiers: {
      'Clima Quente': 1
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Resistência Árida de Lochcliff',
        efeito: '+5 de bônus no primeiro d100 para fome e +1 em Clima Quente.'
      },
      {
        nome: 'Força Bruta de Lochcliff',
        efeito: '+2 de bônus de dano de força (não entra na escala).'
      },
      {
        nome: 'Estigma Urbano (Lochcliff)',
        efeito: 'Nativos não são bem vistos em cidades grandes: penalidade de -1 em Comunicação nestes locais.'
      }
    ],
    vestimentas: [
      { nome: 'Pernas (Armadura de couro)', corte: 1, impacto: 1, perfuracao: 1, durabilidade: 1, peso: 12, volume: 8, reducaoDano: 1 },
      { nome: 'Tronco (Armadura de couro)', corte: 1, impacto: 1, perfuracao: 1, durabilidade: 1, peso: 20, volume: 10, reducaoDano: 1 },
      { nome: 'Capacete (Armadura de couro)', corte: 1, impacto: 1, perfuracao: 1, durabilidade: 1, peso: 5, volume: 3, reducaoDano: 1 },
      { nome: 'Rebraço (Armadura de couro)', corte: 1, impacto: 1, perfuracao: 1, durabilidade: 1, peso: 6, volume: 6, reducaoDano: 1 },
      { nome: 'Botas (Armadura de couro)', corte: 1, impacto: 1, perfuracao: 1, durabilidade: 1, peso: 4, volume: 3, reducaoDano: 1 }
    ]
  },
  {
    id: 'marble_edge',
    name: 'Anões de Marble Edge',
    description: 'Os anões são humanos pequenos e robustos, ótimos forjadores manuais e com grande conhecimento de armas, mas comem muito. Tem +1 para identificar as peças de uma arma e para criar peças manualmente, mas alimentos têm metade do bônus no próximo dado para fome e também tem uma redução de -5 nos dados seguintes contra fome. (Anões são famosos como armeiros e bem vistos em grandes cidades, nestas, os anões recebem +1 em comunicação).',
    proficienciasModifiers: {
      'Forja manual': 1
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Mestre Armeiro Anão',
        efeito: '+1 para identificar as peças de uma arma e +1 para criar peças manualmente.'
      },
      {
        nome: 'Fome Insaciável de Marble Edge',
        efeito: 'Alimentos têm metade do bônus no próximo dado para fome e redução de -5 nos dados seguintes contra fome.'
      },
      {
        nome: 'Renome em Grandes Cidades',
        efeito: 'Famosos como armeiros e bem vistos em grandes cidades: recebem +1 em Comunicação nestes locais.'
      }
    ],
    vestimentas: [
      { nome: 'Luvas (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 10, volume: 2.5, reducaoDano: 5, efeito: '-2 em furtividade' },
      { nome: 'Pernas (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 20, volume: 8, reducaoDano: 5, efeito: '-2 em furtividade' },
      { nome: 'Tronco (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 50, volume: 10, reducaoDano: 5, efeito: '-2 em furtividade' },
      { nome: 'Capacete (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 30, volume: 3, reducaoDano: 5, efeito: '-2 em furtividade' },
      { nome: 'Rebraço (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 15, volume: 6, reducaoDano: 5, efeito: '-2 em furtividade' },
      { nome: 'Botas (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 10, volume: 3, reducaoDano: 5, efeito: '-2 em furtividade' },
      { nome: 'Malha parcial (Ferro completa)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 4, peso: 30, volume: 4, reducaoDano: 5, efeito: '-2 em furtividade' }
    ]
  },
  {
    id: 'cidade_central',
    name: 'Cidadãos da cidade central',
    description: 'Os moradores da cidade central, Shentil, variados em etnia, são bem comunicativos e têm boa relação com qualquer lugar. +2 de comunicação.',
    proficienciasModifiers: {
      'Comunicação': 2
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Elo Cosmopolita de Shentil',
        efeito: 'Boa relação com qualquer lugar (+2 em Comunicação aplicado à ficha).'
      }
    ],
    vestimentas: [
      { nome: 'Capacete (Ferro simples)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 30, volume: 3, reducaoDano: 3, efeito: '-1 em furtividade' },
      { nome: 'Peitoral parcial (Ferro simples)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 50, volume: 10, reducaoDano: 3, efeito: '-1 em furtividade' },
      { nome: 'Braçadeiras (Ferro simples)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 15, volume: 6, reducaoDano: 3, efeito: '-1 em furtividade' },
      { nome: 'Grevas (Ferro simples)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 20, volume: 8, reducaoDano: 3, efeito: '-1 em furtividade' }
    ]
  },
  {
    id: 'dellmont',
    name: 'Cidadãos de Dellmont',
    description: 'Não muito fortes mas engenhosos e organizados, tem pele clara e não são muito altos. Tem vasto conhecimento disseminado entre seu povo. +1 para identificar peças de uma arma e +1 em conhecimento.',
    proficienciasModifiers: {
      'Conhecimento': 1
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Engenho de Dellmont',
        efeito: 'Vasto conhecimento disseminado (+1 em Conhecimento aplicado) e +1 para identificar peças de uma arma.'
      }
    ],
    vestimentas: [
      { nome: 'Pernas (Placas de bambu)', corte: 3, impacto: 2, perfuracao: 2, durabilidade: 2, peso: 15, volume: 8, reducaoDano: 2 },
      { nome: 'Tronco (Placas de bambu)', corte: 3, impacto: 2, perfuracao: 2, durabilidade: 2, peso: 30, volume: 10, reducaoDano: 2 },
      { nome: 'Capacete (Placas de bambu)', corte: 3, impacto: 2, perfuracao: 2, durabilidade: 2, peso: 8, volume: 3, reducaoDano: 2 },
      { nome: 'Rebraço (Placas de bambu)', corte: 3, impacto: 2, perfuracao: 2, durabilidade: 2, peso: 6, volume: 6, reducaoDano: 2 },
      { nome: 'Botas (Placas de bambu)', corte: 3, impacto: 2, perfuracao: 2, durabilidade: 2, peso: 4, volume: 3, reducaoDano: 2 }
    ]
  },
  {
    id: 'tabatos',
    name: 'Sacerdotes do monte Tabatos',
    description: 'Pacíficos e religiosos, os sacerdotes dedicam sua vida ao conhecimento místico no pico do monte Tabatos, em Stonebarrow, tem diversas etnias. Possuem costume ao frio e conhecimento ritualista. +1 no nível de clima para frio e +1 em religião e medicina, porém, -2 em proficiências de força e destreza. (Sacerdotes são mal vistos em locais onde há cultos a demônios, tendo -3 em comunicação nesses locais).',
    proficienciasModifiers: {
      'Clima Frio': 1,
      'Intimidação': -2,
      'Vigor': -2,
      'Furtividade': -2,
      'Atletismo': -2,
      'Acurácia': -2,
      'Esquiva': -2
    },
    conhecimentosModifiers: {
      'Religião': 1,
      'Medicina': 1
    },
    habilidades: [
      {
        nome: 'Devoção do Monte Tabatos',
        efeito: 'Costume ao frio (+1 em Clima Frio). +1 em Religião e Medicina. -2 em proficiências de Força e Destreza.'
      },
      {
        nome: 'Inimizade Herética',
        efeito: 'Mal vistos em locais onde há cultos a demônios: -3 em Comunicação nesses locais.'
      }
    ],
    vestimentas: [
      { nome: 'Manto de sacerdote', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 20, volume: 5, reducaoDano: 0, efeito: 'Religião +1' }
    ]
  },
  {
    id: 'icefield',
    name: 'Nativos da vila Icefield',
    description: 'Têm ouvidos e olhos afiados para a caça numa região coberta de gelo, sua pele é parda e graças a sua distância das demais partes do continente, sua comunicação é precária. +2 no nível de clima para frio, +1 em percepção, intuição e acurácia, porém, -2 em nível de calor e -2 em comunicação.',
    proficienciasModifiers: {
      'Clima Frio': 2,
      'Clima Quente': -2,
      'Percepção': 1,
      'Intuição': 1,
      'Acurácia': 1,
      'Comunicação': -2
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Sentidos de Icefield',
        efeito: '+2 em Clima Frio, -2 em Clima Quente. +1 em Percepção, Intuição e Acurácia; -2 em Comunicação.'
      }
    ],
    vestimentas: [
      { nome: 'Manto de couro grosso', corte: 2, impacto: 2, perfuracao: 2, durabilidade: 2, peso: 30, volume: 6, reducaoDano: 2, efeito: 'Clima Frio +2' }
    ]
  },
  {
    id: 'stonebarrow',
    name: 'Guerreiros de Stonebarrow',
    description: 'Grandes, agressivos e intimidadores, sua comunicação é compensada pelo medo que desperta em quem cruza seu caminho. Tem pele escura e são altos, naturalmente musculosos. +2 em intimidação e em bônus de dano força, também +5 no dado contra resistência, porém seus grandes corpos os tornam passíveis ao cansaço, tendo -1 no dado contra cansaço e recebendo -1 no bônus de bem descansado, tornando o valor máximo de +2.',
    proficienciasModifiers: {
      'Intimidação': 2,
      'Resistência': 5
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Presença Aterradora de Stonebarrow',
        efeito: '+2 em Intimidação e +5 no dado contra Resistência. Bônus de dano de Força +2.'
      },
      {
        nome: 'Corpo Pesado (Stonebarrow)',
        efeito: '-1 no dado contra cansaço e -1 no bônus de bem descansado (valor máximo limitado a +2).'
      }
    ],
    vestimentas: [
      { nome: 'Luvas (Armadura de guerra de Vayekhel)', corte: 4, impacto: 4, perfuracao: 4, durabilidade: 3, peso: 2, volume: 2.5, reducaoDano: 5 },
      { nome: 'Capacete (Armadura de guerra de Vayekhel)', corte: 4, impacto: 4, perfuracao: 4, durabilidade: 3, peso: 30, volume: 3, reducaoDano: 5 },
      { nome: 'Peitoral (Armadura de guerra de Vayekhel)', corte: 4, impacto: 4, perfuracao: 4, durabilidade: 3, peso: 60, volume: 10, reducaoDano: 5 },
      { nome: 'Braçadeiras (Armadura de guerra de Vayekhel)', corte: 4, impacto: 4, perfuracao: 4, durabilidade: 3, peso: 20, volume: 6, reducaoDano: 5 },
      { nome: 'Perneiras (Armadura de guerra de Vayekhel)', corte: 4, impacto: 4, perfuracao: 4, durabilidade: 3, peso: 30, volume: 8, reducaoDano: 5 },
      { nome: 'Botas (Armadura de guerra de Vayekhel)', corte: 4, impacto: 4, perfuracao: 4, durabilidade: 3, peso: 5, volume: 3, reducaoDano: 5 }
    ]
  },
  {
    id: 'daedra',
    name: 'Atiradores da escola de Daedra',
    description: 'Graduados na grande escola de Daedra, em Goundospauh, os atiradores têm grande acurácia e conhecimento de projéteis e itens mágicos. Diversas etnias. +2 em acurácia. Com um clima agradável em Goundospauh, atiradores de Daedra não se dão bem com temperaturas extremas, tendo -1 em nível de clima geral. (Em algumas cidades, considerados assassinos e mentirosos, nessas, -2 de comunicação).',
    proficienciasModifiers: {
      'Acurácia': 2,
      'Clima Quente': -1,
      'Clima Frio': -1
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Precisão de Daedra',
        efeito: '+2 em Acurácia. Sensível a temperaturas extremas: -1 em Clima Quente e -1 em Clima Frio.'
      },
      {
        nome: 'Má Fama (Daedra)',
        efeito: 'Em cidades onde atiradores são tidos como assassinos e mentirosos: -2 em Comunicação.'
      }
    ],
    vestimentas: [
      { nome: 'Terno (Roupas elegantes)', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 14, volume: 2, reducaoDano: 0, efeito: 'Comunicação +1' },
      { nome: 'Calças (Roupas elegantes)', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 6, volume: 1.5, reducaoDano: 0 },
      { nome: 'Sapatos (Roupas elegantes)', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 4, volume: 3, reducaoDano: 0 },
      { nome: 'Chapéu (Roupas elegantes)', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 3, volume: 3, reducaoDano: 0 },
      { nome: 'Luvas (Roupas elegantes)', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 3, volume: 1, reducaoDano: 0 }
    ]
  },
  {
    id: 'monges_nevoa',
    name: 'Monges do pico enevoado',
    description: 'Vivem nas encostas do pico enevoado, Gonduspauh, uma montanha coberta por névoa, que encobre sua localização, os monges aceitam qualquer um que chegue até seus templos. +5 no dado de mentalidade e +1 em intuição.',
    proficienciasModifiers: {
      'Intuição': 1,
      'Mentalidade': 5
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Serenidade do Pico Enevoado',
        efeito: '+5 no dado de Mentalidade e +1 em Intuição.'
      }
    ],
    vestimentas: [
      { nome: 'Panos sagrados', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 7, volume: 4, reducaoDano: 0, efeito: 'Conhecimento +1' }
    ]
  },
  {
    id: 'subterraneos',
    name: 'Povos subterrâneos',
    description: 'Pessoas que vivem debaixo da terra buscando um esconderijo e proteção, desenvolveram um bom olhar para enxergar coisas no escuro das cavernas, além de ter uma boa adaptabilidade. +2 percepção e +5 de bônus no d100 contra adaptabilidade. (As pessoas do subterrâneo são desconfiadas, mas estranhamente, se dão muito bem com os povos das árvores, tendo +2 em comunicação com os mesmos, porém -3 em lugares onde a população não se dá bem com povos subterrâneos).',
    proficienciasModifiers: {
      'Percepção': 2,
      'Adaptabilidade': 5
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Visão das Profundezas',
        efeito: '+2 em Percepção e +5 de bônus no d100 contra Adaptabilidade.'
      },
      {
        nome: 'Relações Subterrâneas',
        efeito: 'Desconfiados, mas se dão bem com povos das árvores (+2 em Comunicação com eles); -3 em lugares onde a população não tolera povos subterrâneos.'
      }
    ],
    vestimentas: [
      { nome: 'Capacete (Carapaça de Chaurus)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 4, volume: 3, reducaoDano: 3 },
      { nome: 'Peitoral parcial (Carapaça de Chaurus)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 15, volume: 10, reducaoDano: 3 },
      { nome: 'Braçadeiras (Carapaça de Chaurus)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 4, volume: 6, reducaoDano: 3 },
      { nome: 'Grevas (Carapaça de Chaurus)', corte: 3, impacto: 3, perfuracao: 3, durabilidade: 3, peso: 6, volume: 8, reducaoDano: 3 }
    ]
  },
  {
    id: 'povos_copas',
    name: 'Povos das copas',
    description: 'Pessoas que buscaram abrigo nas copas das árvores altas em meio a florestas densas, tem uma ótima agilidade para se locomoverem entre as árvores e desenvolveram uma resistência incomum, provavelmente por conta de quedas ao passar dos anos. +2 em atletismo e +5 no d100 contra resistência. (-2 de comunicação em locais que não se dão bem com nativos).',
    proficienciasModifiers: {
      'Atletismo': 2,
      'Resistência': 5
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Agilidade das Copas',
        efeito: '+2 em Atletismo e +5 no d100 contra Resistência.'
      },
      {
        nome: 'Isolamento Arbóreo',
        efeito: '-2 de Comunicação em locais com rejeição a povos nativos.'
      }
    ],
    vestimentas: [
      { nome: 'Pernas (Manto de pele de Tobi Kadachi)', corte: 2, impacto: 2, perfuracao: 2, durabilidade: 3, peso: 6, volume: 8, reducaoDano: 3, efeito: 'Elemental: 3' },
      { nome: 'Tronco (Manto de pele de Tobi Kadachi)', corte: 2, impacto: 2, perfuracao: 2, durabilidade: 3, peso: 30, volume: 15, reducaoDano: 3, efeito: 'Elemental: 3' },
      { nome: 'Botas (Manto de pele de Tobi Kadachi)', corte: 2, impacto: 2, perfuracao: 2, durabilidade: 3, peso: 4, volume: 3, reducaoDano: 3, efeito: 'Elemental: 3' }
    ]
  },
  {
    id: 'hibridos',
    name: 'Híbridos',
    description: 'Seres mestiços entre humanos e criaturas, têm aspectos de besta e algumas habilidades da mesma. Seus bônus vêm de qual animal for escolhido pelo jogador. (Híbridos são odiados por outros povos do continente, ninguém lhe verá com bons olhos, nem mesmo as criaturas. -5 de penalidade em comunicação).',
    proficienciasModifiers: {
      'Comunicação': -5
    },
    conhecimentosModifiers: {},
    habilidades: [
      {
        nome: 'Herança Bestial (Híbrido)',
        efeito: 'Aspectos de criatura/besta. Bônus específicos concedidos de acordo com o animal escolhido. Odiado por todos os povos (-5 permanente em Comunicação).'
      }
    ],
    vestimentas: [
      { nome: 'Trapos velhos', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 1, peso: 5, volume: 3, reducaoDano: 0, efeito: 'Vestimenta esfarrapada de sobrevivência' }
    ]
  }
];

export const getEthnicityById = (idOrName?: string): Ethnicity => {
  if (!idOrName) return ETHNICITIES[0];
  const found = ETHNICITIES.find(
    (e) => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase()
  );
  return found || ETHNICITIES[0];
};

export const isPredefinedEthnicity = (idOrName?: string): boolean => {
  if (!idOrName) return false;
  return ETHNICITIES.some(
    (e) => e.id === idOrName || e.name.toLowerCase() === idOrName.toLowerCase()
  );
};

export const applyEthnicityToCharacter = (
  char: Character,
  newEthnicityId: string,
  customName?: string
): Character => {
  const currentEtniaObj = getEthnicityById(char.etnia);
  const targetEtniaObj = getEthnicityById(newEthnicityId);
  
  // Conhecimentos
  let newConhecimentos = (char.conhecimentos || []).map((c) => ({ ...c }));
  if (currentEtniaObj && currentEtniaObj.conhecimentosModifiers) {
    Object.entries(currentEtniaObj.conhecimentosModifiers).forEach(([kName, val]) => {
      const idx = newConhecimentos.findIndex((k) => k.name.toLowerCase() === kName.toLowerCase());
      if (idx !== -1) {
        newConhecimentos[idx].nivel = Math.max(0, (newConhecimentos[idx].nivel || 0) - val);
      }
    });
  }
  if (targetEtniaObj && targetEtniaObj.conhecimentosModifiers) {
    Object.entries(targetEtniaObj.conhecimentosModifiers).forEach(([kName, val]) => {
      const idx = newConhecimentos.findIndex((k) => k.name.toLowerCase() === kName.toLowerCase());
      if (idx !== -1) {
        newConhecimentos[idx].nivel = (newConhecimentos[idx].nivel || 0) + val;
      } else {
        newConhecimentos.push({
          name: kName,
          nivel: val,
          xp: 0,
          limite: 10
        });
      }
    });
  }

  // Habilidades: remover anteriores originárias de etnia
  let newHabilidades = (char.habilidades || []).filter(
    (h) => !h.id.startsWith('etnia-') && !h.nome.startsWith('[Etnia]')
  );

  if (targetEtniaObj.id !== 'custom' && targetEtniaObj.habilidades.length > 0) {
    targetEtniaObj.habilidades.forEach((hab, idx) => {
      newHabilidades.push({
        id: `etnia-${targetEtniaObj.id}-${idx}`,
        nome: `[Etnia] ${hab.nome}`,
        efeito: hab.efeito
      });
    });
  }

  // Armaduras / Vestimentas: remover anteriores originárias de etnia
  let newArmaduras = (char.armaduras || []).filter(
    (a) => !a.id.startsWith('etnia-armadura-')
  );

  // Adicionar peças individuais da vestimenta inicial
  if (targetEtniaObj.vestimentas && targetEtniaObj.vestimentas.length > 0) {
    targetEtniaObj.vestimentas.forEach((vest, vIdx) => {
      const newArmorPiece: ArmorPiece = {
        id: `etnia-armadura-${targetEtniaObj.id}-${vIdx}`,
        nome: vest.nome,
        corte: vest.corte,
        impacto: vest.impacto,
        perfuracao: vest.perfuracao,
        durabilidade: vest.durabilidade,
        peso: vest.peso,
        volume: vest.volume,
        reducaoDano: vest.reducaoDano,
        efeito: vest.efeito || ''
      };
      newArmaduras.push(newArmorPiece);
    });
  }

  const finalEtniaName =
    targetEtniaObj.id === 'custom'
      ? customName !== undefined
        ? customName
        : 'Customizado'
      : targetEtniaObj.name;

  return {
    ...char,
    etnia: finalEtniaName,
    conhecimentos: newConhecimentos,
    habilidades: newHabilidades,
    armaduras: newArmaduras
  };
};
