export interface SurvivalPenalties {
  damage: number;
  movement: number;
  proficiency: number;
  effects: { name: string; info: string }[];
}

export const getSurvivalPenalties = (hunger: number, thirst: number): SurvivalPenalties => {
  const penalties: SurvivalPenalties = {
    damage: 0,
    movement: 0,
    proficiency: 0,
    effects: []
  };

  const calculateFor = (value: number, type: 'Fome' | 'Sede') => {
    if (value < 5) {
      penalties.damage -= 3;
      penalties.movement -= 2;
      penalties.proficiency -= 1;
      penalties.effects.push({
        name: `${type} Crítica`,
        info: '-3 Dano, -2 Deslocamento, -1 em todas as Proficiências'
      });
    } else if (value < 30) {
      penalties.damage -= 3;
      penalties.movement -= 2;
      penalties.effects.push({
        name: `${type} Grave`,
        info: '-3 Dano, -2 Deslocamento'
      });
    } else if (value < 50) {
      penalties.damage -= 1;
      penalties.movement -= 1;
      penalties.effects.push({
        name: `${type} Moderada`,
        info: '-1 Dano, -1 Deslocamento'
      });
    }
  };

  calculateFor(hunger, 'Fome');
  calculateFor(thirst, 'Sede');

  return penalties;
};
