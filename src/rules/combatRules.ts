import { CONFIG } from './statusRules';

export type Scale = 'C' | 'B' | 'A' | 'S';

export interface Weapon {
  id: string;
  nome: string;
  dano: string;
  acerto: number;
  tipo: string;
  escala: Scale;
  atributoBase: 'FOR' | 'DEX' | 'INT' | 'RIT';
  peso: number;
  volume: number;
  durabilidade: number;
  maxDurabilidade: number;
  corte: number;
  impacto: number;
  perfuracao: number;
  resistencia: number;
}

export const getStatBonus = (statValue: number) => Math.floor(statValue / CONFIG.bonuses.statDivisor);

export const calculateWeaponDamageBonus = (weapon: Weapon, statValue: number) => {
  const baseBonus = getStatBonus(statValue);
  const scaleMult = CONFIG.scales[weapon.escala];
  return Math.floor(baseBonus * scaleMult);
};
