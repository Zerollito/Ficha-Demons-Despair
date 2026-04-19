import { CONFIG } from './statusRules';

export type Scale = '0' | 'D' | 'C' | 'B' | 'A';

export interface Weapon {
  id: string;
  nome: string;
  dano: string;
  acerto: number;
  tipo: string;
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
  const baseBonus = getStatBonus(statValue || 0);
  const escala = weapon?.escala || '0';
  const scaleMult = CONFIG.scales[escala as keyof typeof CONFIG.scales] ?? 0;
  const result = Math.floor(baseBonus * scaleMult);
  return isNaN(result) ? 0 : result;
};
