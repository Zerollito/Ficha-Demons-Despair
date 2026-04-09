import { CONFIG } from './statusRules';
import { getSurvivalPenalties } from './survivalRules';

export interface Stats {
  CON: number;
  RES: number;
  ADP: number;
  MEN: number;
  APR: number;
  FOR: number;
  DEX: number;
  INT: number;
  RIT: number;
}

export const calculateProficiencyBonus = (stats: Stats, name: string, statKeys: (keyof Stats)[], hunger?: number, thirst?: number) => {
  let survivalPenalty = 0;
  if (hunger !== undefined && thirst !== undefined) {
    const penalties = getSurvivalPenalties(hunger, thirst);
    survivalPenalty = penalties.proficiency;
  }

  // Special cases
  let baseBonus = 0;
  if (name === 'Fome') baseBonus = Math.min(stats.RES, stats.ADP);
  else if (name === 'Clima') baseBonus = Math.floor(stats.ADP / 10);
  else if (name === 'Resistência') baseBonus = Math.floor(stats.RES / 2);
  else if (name === 'Adaptabilidade') baseBonus = Math.floor(stats.ADP / 2);
  else if (name === 'Mentalidade') baseBonus = Math.floor(stats.MEN / 2);
  else if (statKeys.length === 1) {
    baseBonus = stats[statKeys[0]] >= CONFIG.bonuses.proficiencySingleThreshold ? 1 : 0;
  } else if (statKeys.length === 2) {
    baseBonus = Math.min(Math.floor(stats[statKeys[0]] / 5), Math.floor(stats[statKeys[1]] / 5));
  }

  return Math.max(0, baseBonus + survivalPenalty);
};

export const PROFICIENCIES = [
  { name: 'Intimidação', stats: ['FOR'] },
  { name: 'Vigor', stats: ['FOR', 'RES'] },
  { name: 'Furtividade', stats: ['DEX'] },
  { name: 'Atletismo', stats: ['CON', 'DEX'] },
  { name: 'Intuição', stats: ['APR', 'MEN'] },
  { name: 'Comunicação', stats: ['APR'] },
  { name: 'Conhecimento', stats: ['INT', 'APR'] },
  { name: 'Percepção', stats: ['INT', 'MEN'] },
  { name: 'Acurácia', stats: ['FOR', 'DEX'] },
  { name: 'Esquiva', stats: ['DEX'] },
  { name: 'Mentalidade', stats: ['MEN'] },
  { name: 'Ritualismo', stats: ['RIT'] },
  { name: 'Fome', stats: ['RES', 'ADP'] },
  { name: 'Clima', stats: ['ADP'] },
  { name: 'Resistência', stats: ['RES'] },
  { name: 'Adaptabilidade', stats: ['ADP'] },
];
