import { CONFIG } from './statusRules';

export interface Item {
  id: string;
  nome: string;
  peso: number;
  volume: number;
  quantidade: number;
  tipo: string;
  durabilidade: number;
  maxDurabilidade: number;
  descricao: string;
  // Campos de Arma
  dano?: string;
  acerto?: number;
  escala?: string;
  atributoBase?: string;
  corte?: number;
  impacto?: number;
  perfuracao?: number;
  resistencia?: number;
  // Campos de Catalisador
  feitico?: number;
  elemental?: number;
  magiaNegra?: number;
  potencial?: number;
  // Campos de Armadura
  reducaoDano?: number;
  efeito?: string;
}

export interface Compartment {
  id: string;
  nome: string;
  volumeMax: number;
  itens: Item[];
  externo?: boolean;
}

export const getArmorWeight = (armor: any): number => {
  return Number(armor.peso) || 0;
};

export const getArmorVolume = (armor: any): number => {
  return Number(armor.volume) || 0;
};

export const getItemPeso = (item: any): number => {
  let w = Number(item.peso) || 0;
  if (item.tipo === "Armadura") {
    return getArmorWeight(item);
  }
  return w;
};

export const getItemVolume = (item: any): number => {
  let v = Number(item.volume) || 0;
  if (item.tipo === "Armadura") {
    return getArmorVolume(item);
  }
  return v;
};

export const calculateInventoryTotals = (compartments: Compartment[] = []) => {
  let totalPeso = 0;
  let totalVolume = 0;
  
  (compartments || []).forEach(comp => {
    (comp.itens || []).forEach(item => {
      // Containers marked as external don't count towards the character's weight
      const itemWeight = getItemPeso(item);
      const itemVolume = getItemVolume(item);
      const qty = item.quantidade !== undefined ? item.quantidade : 1;
      
      if (!comp.externo) {
        totalPeso += itemWeight * qty;
      }
      totalVolume += itemVolume * qty;
    });
  });

  return { peso: totalPeso, volume: totalVolume };
};

export const getLoadPenalties = (currentPeso: number, maxPeso: number) => {
  if (currentPeso <= maxPeso) return CONFIG.penalties.loadThresholds[0];
  
  // Simple logic: if over, apply the penalty from config
  return CONFIG.penalties.loadThresholds[1];
};
