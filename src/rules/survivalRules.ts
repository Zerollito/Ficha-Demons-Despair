export interface SurvivalPenalties {
  damage: number;
  movement: number;
  proficiency: number;
  sanity: number;
  effects: { name: string; info: string }[];
}

export const getSurvivalPenalties = (hunger: number, thirst: number): SurvivalPenalties => {
  const penalties: SurvivalPenalties = {
    damage: 0,
    movement: 0,
    proficiency: 0,
    sanity: 0,
    effects: []
  };

  // Hunger penalties
  if (hunger < 5) {
    penalties.damage -= 5;
    penalties.sanity -= 2;
    penalties.movement -= 2;
    penalties.proficiency -= 1;
    penalties.effects.push({
      name: `Fome Crítica`,
      info: '-5 Dano, -2 Sanidade, -2 Deslocamento, -1 em todas as Proficiências'
    });
  } else if (hunger < 30) {
    penalties.damage -= 3;
    penalties.sanity -= 2;
    penalties.movement -= 2;
    penalties.effects.push({
      name: `Fome Grave`,
      info: '-3 Dano, -2 Sanidade, -2 Deslocamento'
    });
  } else if (hunger < 50) {
    penalties.damage -= 1;
    penalties.movement -= 1;
    penalties.effects.push({
      name: `Fome Moderada`,
      info: '-1 Dano, -1 Deslocamento'
    });
  }

  // Thirst penalties
  let thirstMovementPenalty = 0;
  if (thirst < 5) {
    penalties.damage -= 3;
    thirstMovementPenalty = -2;
    penalties.proficiency -= 1;
    penalties.effects.push({
      name: `Sede Crítica`,
      info: '-3 Dano, -2 Deslocamento, -1 em todas as Proficiências'
    });
  } else if (thirst < 30) {
    penalties.damage -= 3;
    thirstMovementPenalty = -2;
    penalties.effects.push({
      name: `Sede Grave`,
      info: '-3 Dano, -2 Deslocamento'
    });
  } else if (thirst < 50) {
    penalties.damage -= 1;
    thirstMovementPenalty = -1;
    penalties.effects.push({
      name: `Sede Moderada`,
      info: '-1 Dano, -1 Deslocamento'
    });
  }

  // Use the worst movement penalty between hunger and thirst
  penalties.movement = Math.min(penalties.movement, thirstMovementPenalty);

  return penalties;
};
