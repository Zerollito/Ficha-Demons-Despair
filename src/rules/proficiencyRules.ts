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

export const calculateProficiencyBonus = (
  stats: Stats, 
  name: string, 
  statKeys: (keyof Stats)[], 
  hunger?: number, 
  thirst?: number,
  fatigue?: number,
  climate?: number,
  climateProficiency?: number,
  manualBonus: number = 0
) => {
  let penalty = 0;
  
  // Negative effects should not affect Fome and Clima
  if (name !== 'Fome' && name !== 'Clima') {
    // Survival penalties (Hunger/Thirst)
    if (hunger !== undefined && thirst !== undefined) {
      const penalties = getSurvivalPenalties(hunger, thirst);
      penalty += penalties.proficiency;
    }

    // Fatigue penalties
    if (fatigue !== undefined && fatigue <= 3) {
      penalty -= 1;
    }

    // Climate penalties
    if (climate !== undefined && climateProficiency !== undefined) {
      const diff = Math.abs(climate) - climateProficiency;
      if (diff >= 2) {
        if (statKeys.some(k => ['INT', 'APR', 'RIT'].includes(k))) {
          penalty -= 1;
        }
        if (name === 'Mentalidade') {
          penalty -= 5;
        }
      }
      if (diff >= 4) {
        if (statKeys.some(k => ['FOR', 'DEX', 'RES', 'ADP', 'CON'].includes(k))) {
          penalty -= 1;
        }
      }
    }
  }

  // Special cases and general scaling logic
  let baseBonus = 0;
  if (name === 'Fome') {
    // 2+2 rule for dual stat
    baseBonus = Math.min(Math.floor(stats.RES / 2), Math.floor(stats.ADP / 2));
  } else if (name === 'Clima') {
    // 10 points = 1
    baseBonus = Math.floor(stats.ADP / 10);
  } else if (statKeys.length === 1) {
    // Scaling: 10 points = +1
    baseBonus = Math.floor(stats[statKeys[0]] / (CONFIG.bonuses.proficiencySingleThreshold || 10));
  } else if (statKeys.length === 2) {
    // Scaling: 5 points in one AND 5 in other = +1
    baseBonus = Math.min(
      Math.floor(stats[statKeys[0]] / (CONFIG.bonuses.proficiencyDualThreshold || 5)), 
      Math.floor(stats[statKeys[1]] / (CONFIG.bonuses.proficiencyDualThreshold || 5))
    );
  }

  return Math.max(0, baseBonus + penalty + manualBonus);
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
