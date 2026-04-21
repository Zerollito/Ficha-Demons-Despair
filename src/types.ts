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

export interface Character {
  id: string;
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
}
