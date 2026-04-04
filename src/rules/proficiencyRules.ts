import { CONFIG } from './statusRules';

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

export const calculateProficiencyBonus = (stats: Stats, name: string, statKeys: (keyof Stats)[]) => {
  // Special cases
  if (name === 'Fome') return Math.min(stats.RES, stats.ADP);
  if (name === 'Clima') return Math.floor(stats.ADP / 10);
  if (name === 'Resistência') return Math.floor(stats.RES / 2);
  if (name === 'Adaptabilidade') return Math.floor(stats.ADP / 2);
  if (name === 'Mentalidade') return Math.floor(stats.MEN / 2);

  if (statKeys.length === 1) {
    // General rule for 1 stat: +1 every 10 points (implied by previous logic)
    // But user says "As proficiências que usam 2 status, em geral..."
    // Let's keep the 1 stat logic as is or adjust if needed.
    return stats[statKeys[0]] >= CONFIG.bonuses.proficiencySingleThreshold ? 1 : 0;
  }
  if (statKeys.length === 2) {
    // +1 for every 5 points in BOTH stats
    return Math.min(Math.floor(stats[statKeys[0]] / 5), Math.floor(stats[statKeys[1]] / 5));
  }
  return 0;
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
