import rulesConfig from './rulesConfig.json';
import { getSurvivalPenalties } from './survivalRules';
import { NegativeEffect } from '../types';

export const CONFIG = rulesConfig;

export const getVidaMaxima = (con: number) => CONFIG.vitals.baseVida + (con * CONFIG.vitals.vidaPerCon);
export const getManaMaxima = (apr: number) => CONFIG.vitals.baseMana + (apr * CONFIG.vitals.manaPerApr);
export const getSanidadeMaxima = (men: number) => CONFIG.vitals.baseSanidade + (men * CONFIG.vitals.sanidadePerMen);
export const getCargaMaxima = (res: number) => CONFIG.vitals.baseCarga + (res * CONFIG.vitals.cargaPerRes);

export const getNegativeEffectPenalties = (effects: NegativeEffect[]) => {
  let extraDamageTaken = 0;
  let movementPenaltyMult = 1;
  let dodgePenaltyMult = 1;
  let accuracyPenaltyTrait = 0;
  let weaponDefensePenalty = 0;
  let bleedingDamage = 0;
  let accuracyPenaltyMult = 1;

  effects.forEach(effect => {
    if (effect.type === 'Ossos Quebrados') {
      // extraDamageTaken handled locally in resolveCombat (Lvl Atq logic)
    } else if (effect.type === 'Sangramento') {
      bleedingDamage += effect.stacks || 1;
    } else if (effect.type === 'Hemorragia') {
      // extraDamageTaken handled locally in resolveCombat
      
      const applyMovement = effect.location.includes('Perna') || effect.location.includes('Tronco');
      const applyCombat = effect.location.includes('Braço') || effect.location.includes('Tronco');
      
      if (applyMovement) {
        movementPenaltyMult *= (2/3);
        dodgePenaltyMult *= (2/3);
      }
      if (applyCombat) {
        accuracyPenaltyMult *= (2/3);
        weaponDefensePenalty += 2;
      }
    } else if (effect.type === 'Caído' || effect.type === 'Tonto' || (effect.type as any) === 'Preso Parcialmente') {
      // These effects grant advantage to attackers, handle in resolveCombat
      dodgePenaltyMult *= 0.5; // Example penalty for being downed/stunned
    }
  });

  return {
    extraDamageTaken,
    movementPenaltyMult,
    dodgePenaltyMult,
    accuracyPenaltyTrait,
    accuracyPenaltyMult,
    weaponDefensePenalty,
    bleedingDamage
  };
};

export const getDeslocamentoBase = (dex: number, effects: NegativeEffect[] = [], hunger?: number, thirst?: number, climate?: number, climateProficiency?: number) => {
  let base = CONFIG.vitals.baseDeslocamento + Math.floor(dex / CONFIG.vitals.dexPerDeslocamento);
  
  const penalties = getNegativeEffectPenalties(effects);
  base = Math.floor(base * penalties.movementPenaltyMult);

  // Survival penalties (Hunger/Thirst) removed from base - applied at final calculation in App.tsx
  // to ensure they are added after multipliers and avoid double dipping
  /*
  if (hunger !== undefined && thirst !== undefined) {
    const survival = getSurvivalPenalties(hunger, thirst);
    base += survival.movement; 
  }
  */

  // Climate penalties (Hipotermia/Desidratação)
  if (climate !== undefined && climateProficiency !== undefined) {
    const diff = Math.abs(climate) - climateProficiency;
    if (diff >= 6) {
      base = Math.floor(base / 2);
    }
  }

  return Math.max(0, base);
};
