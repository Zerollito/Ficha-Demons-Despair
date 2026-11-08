import { CONFIG } from './statusRules';

export type Scale = '0' | 'D' | 'C' | 'B' | 'A';

export interface Weapon {
  id: string;
  nome: string;
  dano: string;
  acerto: number;
  tipo: string;
  categoria?: 'Arma Branca' | 'Arma de Fogo' | 'Arco';
  escala: Scale;
  atributoBase: 'Força' | 'Destreza' | 'Inteligência' | 'Ritual';
  peso: number;
  volume: number;
  durabilidade: number;
  maxDurabilidade: number;
  corte: number;
  impacto: number;
  perfuracao: number;
  resistencia: number;
  efeito?: string;
  quantidade?: number;
  municaoTotal?: number;
  municaoCarregada?: number;
  bulletId?: string;
  arrowId?: string;
  magazineAmmo?: any[];
  municaoDano?: string;
  durabilidadeMaxUtil?: number;
}

export interface Catalyst {
  id: string;
  nome: string;
  tipo: string;
  escala: Scale;
  atributoBase: 'Inteligência';
  peso: number;
  volume: number;
  durabilidade: number;
  maxDurabilidade: number;
  feitico: number;
  elemental: number;
  magiaNegra: number;
  potencial: number;
  efeito?: string;
}

export const getStatBonus = (statValue: number) => Math.floor(statValue / CONFIG.bonuses.statDivisor);

export const calculateWeaponDamageBonus = (weapon: Weapon | Catalyst, statValue: number) => {
  if (!weapon) return 0;
  // Armas de fogo não possuem bônus de escala de atributos (apenas armas brancas e arcos escalam)
  const cat = String((weapon as any).categoria || (weapon as any).tipo || (weapon as any).subtipo || "").toLowerCase();
  const nome = String((weapon as any).nome || (weapon as any).name || "").toLowerCase();
  if (cat.includes('fogo') || nome.includes('pistola') || nome.includes('revólver') || nome.includes('revolver') || nome.includes('espingarda') || nome.includes('rifle') || nome.includes('fuzil') || nome.includes('bacamarte') || nome.includes('garrucha') || nome.includes('mosquete')) {
    return 0;
  }

  const baseBonus = getStatBonus(statValue || 0);
  const escala = weapon?.escala || '0';
  const scaleMult = CONFIG.scales[escala as keyof typeof CONFIG.scales] ?? 0;
  const result = Math.floor(baseBonus * scaleMult);
  return isNaN(result) ? 0 : result;
};
