import { Stats } from './rules/proficiencyRules';
import { Item, Compartment } from './rules/inventoryRules';
import { Weapon, Catalyst } from './rules/combatRules';
import { Knowledge } from './rules/knowledgeRules';

export type { Stats, Weapon, Catalyst, Item, Compartment };

export interface ArmorPiece {
  id: string;
  nome: string;
  corte: number;
  impacto: number;
  perfuracao: number;
  durabilidade: number;
  peso: number;
  volume: number;
  reducaoDano: number;
  efeito: string;
}

export interface Spell {
  id: string;
  nome: string;
  escola: string;
  tipo: 'Ataque' | 'Efeito' | 'Utilidade';
  escala: '0' | 'D' | 'C' | 'B' | 'A';
  efeito: string;
  dano: string;
  mana: number;
  acerto: number;
}

export interface Ability {
  id: string;
  nome: string;
  efeito: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  masterId: string;
  inviteCode: string;
  createdAt: any;
  playerEmails?: string[];
  masterEmail?: string;
}

export interface TableToken {
  id: string;
  name: string;
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  size: number;
  imageUrl?: string;
  type: 'character' | 'creature' | 'aoe';
  aoeShape?: 'circle' | 'square' | 'rectangle';
  aoeColor?: string;
  aoeWidth?: number; // width in grid units (e.g., 2, 3, etc.)
  aoeHeight?: number; // height in grid units
  characterId?: string;
  userId?: string;
  hp?: number;
  maxHp?: number;
  initiative?: number;
  color?: string;
  description?: string;
  // Stats rápidos para monstros
  stats?: {
    acuracia?: number;
    esquiva?: number;
    ataque: { 
      corte: number; perfuracao: number; impacto: number; resistencia: number;
      feitico: number; elemental: number; magiaNegra: number; potencial: number;
    };
    defesa: { 
      corte: number; perfuracao: number; impacto: number;
      feitico: number; elemental: number; magiaNegra: number;
    };
  };
  acoes?: MonsterAction[];
  efeitosNegativos?: NegativeEffect[];
  deslocamento?: number;
  bonusDeslocamento?: number;
  isDefending?: boolean;
  defenseType?: 'Shield' | 'Weapon';
  defenseWeaponId?: string;
  defendedAt?: number; // Timestamp or turn count
  defenseRounds?: number;
  armas?: any[];
  catalisadores?: any[];
  armaduras?: any[];
  acessorios?: any[];
  compartimentos?: any[];
}

export interface CalendarEvent {
  id: string;
  day: number;
  month: number;
  year?: number;
  title: string;
  description?: string;
  color?: string;
}

export interface TableConfig {
  mapUrl?: string;
  gridSize: number;
  showGrid: boolean;
  masterFog: boolean;
  gridColor?: string;
  date?: {
    day: number;
    month: number;
    year: number;
  };
  time?: {
    hour: number;
    minute: number;
  };
  weather?: string;
  events?: CalendarEvent[];
  updatedAt?: string;
  lastCombatRoll?: any;
}

export interface MonsterAction {
  id: string;
  name: string;
  type: 'Major' | 'Minor';
  categoria: 'Corte' | 'Perfuração' | 'Impacto' | 'Feitiço' | 'Elemental' | 'Magia Negra' | 'Efeito' | 'Outro';
  acerto: number | string;
  dano: string;
  description: string;
  mana?: number | string;
  efeito?: string;
}

export interface BestiaryMonster {
  id: string;
  name: string;
  imageUrl?: string;
  maxHp: number | string;
  size?: number;
  esquiva: number | string;
  acuracia: number | string;
  deslocamento: string;
  bonus: string;
  
  // Níveis de Ataque
  ataque: {
    corte: number | string;
    perfuracao: number | string;
    impacto: number | string;
    resistencia: number | string;
    feitico: number | string;
    elemental: number | string;
    magiaNegra: number | string;
    potencial: number | string;
  };

  // Níveis de Defesa
  defesa: {
    corte: number | string;
    perfuracao: number | string;
    impacto: number | string;
    feitico: number | string;
    elemental: number | string;
    magiaNegra: number | string;
  };

  // Lore / Informações
  local?: string;
  personalidade?: string;
  gostaNaoGosta?: string;
  partesUteis?: string;
  informacoes?: string;
  habitos?: string;

  // Lista de Ações/Ataques
  acoes: MonsterAction[];

  masterId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NegativeEffect {
  id: string;
  type: 'Ossos Quebrados' | 'Sangramento' | 'Hemorragia' | 'Caído' | 'Tonto' | 'Preso Parcialmente';
  location: string; 
  stacks: number; // For Sangramento (up to 3), or hit counter for permanent damage
  daysRemaining: number;
  treated: boolean;
  depth?: number; // For Sangramento (extra days)
  isIncurable?: boolean;
  isUnusable?: boolean;
}

export interface TocaCreature {
  id: string;
  name: string;
  imageUrl?: string;
  maxHp: number;
  hpAtual?: number;
  size?: number;
  esquiva: number;
  acuracia: number;
  deslocamento: string;
  bonus: string;
  ataque: {
    corte: number;
    perfuracao: number;
    impacto: number;
    resistencia: number;
    feitico: number;
    elemental: number;
    magiaNegra: number;
    potencial: number;
  };
  defesa: {
    corte: number;
    perfuracao: number;
    impacto: number;
    feitico: number;
    elemental: number;
    magiaNegra: number;
  };
  acoes: MonsterAction[];
  
  // Modificadores extras adicionados para a Toca:
  fome: number;
  sede: number;
  clima: number;
  carga: number;

  armas?: Weapon[];
  catalisadores?: Catalyst[];
  armaduras?: ArmorPiece[];
  acessorios?: ArmorPiece[];
  compartimentos?: Compartment[];

  local?: string;
  personalidade?: string;
  gostaNaoGosta?: string;
  partesUteis?: string;
  informacoes?: string;
  habitos?: string;
}

export interface Character {
  id: string;
  userId: string;
  userEmail?: string;
  campaignId?: string;
  isRemoteSynced?: boolean;
  nome: string;
  etnia: string;
  dinheiro: {
    C: number;
    B: number;
    P: number;
    O: number;
  };
  
  vidaAtual: number;
  manaAtual: number;
  sanidadeAtual: number;
  fome: number;
  sede: number;
  cansaco: number;
  
  defesa: {
    "Cabeça": number;
    "Tronco": number;
    "Braço Esquerdo": number;
    "Braço Direito": number;
    "Pernas": number;
  };
  
  clima: number;
  
  stats: Stats;
  statsXP: Stats; // XP for each stat
  
  bonusProficiencias?: { [key: string]: number }; // Manual bonuses for each proficiency
  
  joias: string[];
  imagem?: string;
  armas: Weapon[];
  catalisadores: Catalyst[];
  habilidades: Ability[];
  magias: Spell[];
  armaduras: ArmorPiece[];
  acessorios: ArmorPiece[];
  compartimentos: Compartment[];
  conhecimentos: Knowledge[];
  efeitosNegativos: NegativeEffect[];
  anotacoes: { id: string; titulo: string; conteudo: string }[];
  escalas: Escala[];
  dadosCustomizados: { id: string; lados: number; nome: string }[];
  imagens: { id: string; url: string; titulo: string }[];
  itens: Item[];
  bonusCarga?: number;
  bonusDeslocamento?: number;
  isDefending?: boolean;
  defenseType?: 'Shield' | 'Weapon';
  defenseWeaponId?: string;
  tocaCreatures?: TocaCreature[];
  bonusFomeProximaRolagem?: number;
  acoes?: MonsterAction[];
  local?: string;
  personalidade?: string;
  gostaNaoGosta?: string;
  informacoes?: string;
  habitos?: string;
  ataque?: {
    corte: number | string;
    perfuracao: number | string;
    impacto: number | string;
    resistencia: number | string;
    feitico: number | string;
    elemental: number | string;
    magiaNegra: number | string;
    potencial: number | string;
  };
}

export interface Escala {
  id: string;
  nome: string;
  nivel: number;
  xp: number;
  bonus?: string;
}

export interface AppState {
  characters: Character[];
  activeCharacterId: string | null;
  userProfile?: UserProfile | null;
  activeCampaignId?: string | null;
  campaigns?: Campaign[];
  dirtyCharacterIds?: string[]; // IDs with unsaved changes
}
