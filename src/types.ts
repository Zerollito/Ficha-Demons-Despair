import { Stats } from './rules/proficiencyRules';
import { Item, Compartment } from './rules/inventoryRules';
import { Weapon, Catalyst } from './rules/combatRules';
import { Knowledge } from './rules/knowledgeRules';

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
  hp?: number;
  maxHp?: number;
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
}

export interface TableConfig {
  mapUrl?: string;
  gridSize: number;
  showGrid: boolean;
  masterFog: boolean;
  gridColor?: string;
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

export interface Character {
  id: string;
  userId: string;
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
  fome: number;
  sede: number;
  cansaco: number;
  
  defesa: {
    Cabeça: number;
    Torso: number;
    Braços: number;
    Pernas: number;
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
  efeitosNegativos: string[];
  anotacoes: { id: string; titulo: string; conteudo: string }[];
  escalas: Escala[];
  dadosCustomizados: { id: string; lados: number; nome: string }[];
  imagens: { id: string; url: string; titulo: string }[];
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
}
