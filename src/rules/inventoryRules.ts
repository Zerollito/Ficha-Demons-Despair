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
}

export interface Compartment {
  id: string;
  nome: string;
  volumeMax: number;
  itens: Item[];
}

export const calculateInventoryTotals = (compartments: Compartment[] = []) => {
  let totalPeso = 0;
  let totalVolume = 0;
  
  (compartments || []).forEach(comp => {
    (comp.itens || []).forEach(item => {
      totalPeso += (item.peso || 0) * (item.quantidade || 0);
      totalVolume += (item.volume || 0) * (item.quantidade || 0);
    });
  });

  return { peso: totalPeso, volume: totalVolume };
};

export const getLoadPenalties = (currentPeso: number, maxPeso: number) => {
  if (currentPeso <= maxPeso) return CONFIG.penalties.loadThresholds[0];
  
  // Simple logic: if over, apply the penalty from config
  return CONFIG.penalties.loadThresholds[1];
};
