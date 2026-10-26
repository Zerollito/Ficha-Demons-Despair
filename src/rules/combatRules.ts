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
  durabilidadeMaxUtil?: number;
  municaoDano?: string;
  capacidadePente?: number;
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

export const isFirearmWeapon = (weapon: any): boolean => {
  if (!weapon) return false;
  const categoria = ((weapon as any)?.categoria || '').toLowerCase();
  const tipo = ((weapon as any)?.tipo || '').toLowerCase();
  const nome = ((weapon as any)?.nome || '').toLowerCase();
  if (categoria === 'arma de fogo' || tipo === 'arma de fogo') return true;
  return ['pistola', 'revol', 'rifle', 'fuzil', 'escopeta', 'trabuco', 'flintlock', 'garrucha'].some(w => nome.includes(w));
};

export const calculateWeaponDamageBonus = (weapon: Weapon | Catalyst, statValue: number) => {
  if (!weapon) return 0;

  // Armas de fogo NÃO têm escala (apenas armas brancas e arcos possuem escala)
  if (isFirearmWeapon(weapon)) {
    return 0;
  }

  const baseBonus = getStatBonus(statValue || 0);
  const escala = weapon?.escala || '0';
  const scaleMult = CONFIG.scales[escala as keyof typeof CONFIG.scales] ?? 0;
  const result = Math.floor(baseBonus * scaleMult);
  return isNaN(result) ? 0 : result;
};

