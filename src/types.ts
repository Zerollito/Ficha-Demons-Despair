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
  type: 'character' | 'creature';
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
  isDefending?: boolean;
  defenseType?: 'Shield' | 'Weapon';
  defenseWeaponId?: string;
  defendedAt?: number; // Timestamp or turn count
  defenseRounds?: number;
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
}

export interface MonsterAction {
  id: string;
  name: string;
  type: 'Major' | 'Minor';
  categoria: 'Corte' | 'Perfuração' | 'Impacto' | 'Feitiço' | 'Elemental' | 'Magia Negra' | 'Efeito' | 'Outro';
  acerto: number | string;
  dano: string;
  description: string;
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

export interface Character {
  id: string;
  userId: string;
  userEmail?: string;
  campaignId?: string;
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
  isDefending?: boolean;
  defenseType?: 'Shield' | 'Weapon';
  defenseWeaponId?: string;
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
