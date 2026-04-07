import { Stats } from './rules/proficiencyRules';
import { Item, Compartment } from './rules/inventoryRules';
import { Weapon } from './rules/combatRules';
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
  
  clima: {
    frio: number;
    calor: number;
  };
  
  stats: Stats;
  statsXP: Stats; // XP for each stat
  
  joias: string[];
  imagem?: string;
  armas: Weapon[];
  habilidades: Ability[];
  magias: Spell[];
  armaduras: ArmorPiece[];
  acessorios: ArmorPiece[];
  compartimentos: Compartment[];
  conhecimentos: Knowledge[];
  efeitosNegativos: string[];
  anotacoes: { id: string; titulo: string; conteudo: string }[];
  dadosCustomizados: { id: string; lados: number; nome: string }[];
}

export interface AppState {
  characters: Character[];
  activeCharacterId: string | null;
}
