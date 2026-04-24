import { CONFIG } from './statusRules';

export interface Knowledge {
  name: string;
  nivel: number;
  xp: number;
  limite: number;
}

export const getXpToNextLevel = (currentLevel: number) => {
  // nivel -1->0 = 5, 0->1 = 5, cada nível seguinte +5
  const level = Math.max(0, currentLevel);
  return CONFIG.knowledge.baseXp + (level * CONFIG.knowledge.xpIncrement);
};

export const INITIAL_KNOWLEDGES = [
  'Flora', 'Minerais', 'Magia', 'Forja artesanal', 'Forja comum', 
  'Geografia', 'Navegação', 'Mecânica', 'história', 'Religião', 
  'Medicina', 'Fauna', 'Alquimia', 'Armas de fogo', 'Arqueologia', 
  'Sobrevivência', 'Demônios', 'Culinária', 'Clima'
];
