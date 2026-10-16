import { CONFIG, getNegativeEffectPenalties } from './statusRules';
import { getSurvivalPenalties } from './survivalRules';
import { NegativeEffect } from '../types';

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
  manualBonus: number = 0,
  effects: NegativeEffect[] = [],
  sanity?: number,
  maxSanity?: number,
  etniaModifier: number = 0,
  knowledgeLevel?: number
) => {
  let penalty = 0;
  
  // Negative effects should not affect Fome and Clima
  let baseBonus = 0;
  if (name === 'Fome') {
    // Every 1 point in BOTH RES and ADP = +1
    baseBonus = Math.min(stats.RES, stats.ADP);
  } else if (name === 'Resistência') {
    // Every 2 points = +1
    baseBonus = Math.floor(stats.RES / 2);
  } else if (name === 'Adaptabilidade') {
    // Every 2 points = +1
    baseBonus = Math.floor(stats.ADP / 2);
  } else if (name === 'Mentalidade') {
    // Every 2 points in MEN = +1
    baseBonus = Math.floor(stats.MEN / 2);
  } else if (name === 'Clima Quente' || name === 'Clima Frio') {
    // 10 points = 1
    baseBonus = Math.floor(stats.ADP / 10);
  } else if (name === 'Forja manual' || name === 'Forja rústica') {
    // -1 se nível 0, 0 se nível 1, a partir do nível 2 ganha +1 por nível (máx +4)
    const lvl = knowledgeLevel !== undefined ? knowledgeLevel : 0;
    if (lvl <= 0) {
      baseBonus = -1;
    } else if (lvl === 1) {
      baseBonus = 0;
    } else {
      // Nível 2 = +1, Nível 3 = +2, Nível 4 = +3, Nível 5 = +4 (máximo +4)
      baseBonus = Math.min(4, lvl - 1);
    }
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

  if (name !== 'Fome' && name !== 'Clima') {
    // Survival penalties (Hunger/Thirst)
    if (hunger !== undefined && thirst !== undefined) {
      const penalties = getSurvivalPenalties(hunger, thirst);
      penalty += penalties.proficiency;
      
      // Specifically for Mentalidade (Sanity), apply the sanity penalty
      if (name === 'Mentalidade') {
        penalty += penalties.sanity;
      }
    }

    // Negative effect penalties (Hemorragia etc)
    if (effects) {
      const effectPenalties = getNegativeEffectPenalties(effects);
      if (name === 'Acurácia') {
        baseBonus = Math.floor(baseBonus * effectPenalties.accuracyPenaltyMult);
      }
      if (name === 'Esquiva') {
        baseBonus = Math.floor(baseBonus * effectPenalties.dodgePenaltyMult);
      }
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

    // Sanity penalties (Sanidade)
    if (sanity !== undefined && maxSanity !== undefined && maxSanity > 0) {
      if (statKeys.some(k => ['APR', 'MEN', 'INT'].includes(k))) {
        const ratio = sanity / maxSanity;
        if (ratio <= 0.25) {
          penalty -= 2;
        } else if (ratio <= 0.50) {
          penalty -= 1;
        }
      }
    }
  }

  const total = baseBonus + penalty + manualBonus + etniaModifier;
  console.log(`Proficiency: ${name}, base: ${baseBonus}, penalty: ${penalty}, manual: ${manualBonus}, etnia: ${etniaModifier}, total: ${total}`);
  return total;
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
  { name: 'Esquiva', stats: ['DEX', 'ADP'] },
  { name: 'Mentalidade', stats: ['MEN'] },
  { name: 'Ritualismo', stats: ['RIT'] },
  { name: 'Fome', stats: ['RES', 'ADP'] },
  { name: 'Clima Quente', stats: ['ADP'] },
  { name: 'Clima Frio', stats: ['ADP'] },
  { name: 'Resistência', stats: ['RES'] },
  { name: 'Adaptabilidade', stats: ['ADP'] },
  { name: 'Forja manual', stats: [] },
  { name: 'Forja rústica', stats: [] },
];
