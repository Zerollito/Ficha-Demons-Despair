import rulesConfig from './rulesConfig.json';

export const CONFIG = rulesConfig;

export const getVidaMaxima = (con: number) => CONFIG.vitals.baseVida + (con * CONFIG.vitals.vidaPerCon);
export const getManaMaxima = (apr: number) => CONFIG.vitals.baseMana + (apr * CONFIG.vitals.manaPerApr);
export const getCargaMaxima = (res: number) => CONFIG.vitals.baseCarga + (res * CONFIG.vitals.cargaPerRes);
export const getDeslocamentoBase = (dex: number) => CONFIG.vitals.baseDeslocamento + Math.floor(dex / CONFIG.vitals.dexPerDeslocamento);
