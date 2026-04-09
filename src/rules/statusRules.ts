import rulesConfig from './rulesConfig.json';
import { getSurvivalPenalties } from './survivalRules';

export const CONFIG = rulesConfig;

export const getVidaMaxima = (con: number) => CONFIG.vitals.baseVida + (con * CONFIG.vitals.vidaPerCon);
export const getManaMaxima = (apr: number) => CONFIG.vitals.baseMana + (apr * CONFIG.vitals.manaPerApr);
export const getCargaMaxima = (res: number) => CONFIG.vitals.baseCarga + (res * CONFIG.vitals.cargaPerRes);
export const getDeslocamentoBase = (dex: number, hunger?: number, thirst?: number, climate?: number, climateProficiency?: number) => {
  let base = CONFIG.vitals.baseDeslocamento + Math.floor(dex / CONFIG.vitals.dexPerDeslocamento);
  
  if (hunger !== undefined && thirst !== undefined) {
    const penalties = getSurvivalPenalties(hunger, thirst);
    base += penalties.movement;
  }

  if (climate !== undefined && climateProficiency !== undefined) {
    const diff = Math.abs(climate) - climateProficiency;
    if (diff >= 6) {
      base = Math.floor(base / 2);
    }
  }

  return Math.max(0, base);
};
