import { MaterialData } from './materials';
import { Weapon, Scale } from '../rules/combatRules';

export interface WeaponFormula {
  nome: string;
  partes: string[];
  corteMult: number;
  corteBonus: number;
  impactoMult: number;
  impactoBonus: number;
  perfuracaoMult: number;
  perfuracaoBonus: number;
  durabilidadeBonus: number;
  durabilidadeMult: number;
  acertoBase: number;
  danoBase: string;
  pesoBase: number;
  volumeBase: number;
  atributoBase: 'Força' | 'Destreza';
  escala: Scale;
}

export const WEAPON_FORMULAS: Record<string, WeaponFormula> = {
  "Espada curta": {
    nome: "Espada curta",
    partes: ["cabo médio", "guarda", "lâmina média"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 1/3, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "d8", pesoBase: 9.5, volumeBase: 8,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Espada larga": {
    nome: "Espada larga",
    partes: ["cabo grande", "guarda grande", "lâmina larga"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 2/3, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 1,
    acertoBase: 16, danoBase: "d12", pesoBase: 14.5, volumeBase: 14,
    atributoBase: 'Força', escala: 'C'
  },
  "Lança": {
    nome: "Lança",
    partes: ["haste longa", "lâmina pequena"],
    corteMult: 1/3, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 1,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 16, danoBase: "2d6", pesoBase: 16, volumeBase: 17,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Adaga": {
    nome: "Adaga",
    partes: ["cabo pequeno", "lâmina pequena"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 10, danoBase: "d4", pesoBase: 1.5, volumeBase: 3,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Maça": {
    nome: "Maça",
    partes: ["cabo grande", "cabeça de maça"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 1, impactoBonus: 0,
    perfuracaoMult: 0, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "1d6+1d4", pesoBase: 20, volumeBase: 5.4,
    atributoBase: 'Força', escala: 'D'
  },
  "Katana": {
    nome: "Katana",
    partes: ["cabo", "guarda tsuba média", "lâmina curva média"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 2/3, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "2d6", pesoBase: 9, volumeBase: 7.8,
    atributoBase: 'Destreza', escala: 'C'
  },
  "Machado grande": {
    nome: "Machado grande",
    partes: ["haste", "cabeça de machado grande"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 1, impactoBonus: 1,
    perfuracaoMult: 0, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 1,
    acertoBase: 16, danoBase: "2d8", pesoBase: 30, volumeBase: 11.5,
    atributoBase: 'Força', escala: 'C'
  },
  "Machado de mão": {
    nome: "Machado de mão",
    partes: ["cabo grande", "cabeça de machado"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 2/3, impactoBonus: 0,
    perfuracaoMult: 0, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "d8", pesoBase: 14, volumeBase: 5,
    atributoBase: 'Força', escala: 'D'
  },
  "Alabarda": {
    nome: "Alabarda",
    partes: ["haste longa", "lâmina média"],
    corteMult: 2/3, corteBonus: 0,
    impactoMult: 2/3, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 16, danoBase: "2d6", pesoBase: 22, volumeBase: 19,
    atributoBase: 'Força', escala: 'C'
  },
  "Rapieira": {
    nome: "Rapieira",
    partes: ["cabo", "lâmina fina média"],
    corteMult: 1/3, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 1,
    durabilidadeMult: 1/3, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "2d4", pesoBase: 8, volumeBase: 8,
    atributoBase: 'Destreza', escala: 'C'
  },
  "Martelo": {
    nome: "Martelo",
    partes: ["cabo grande", "cabeça de martelo"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 1, impactoBonus: 1,
    perfuracaoMult: 0, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 1,
    acertoBase: 14, danoBase: "d12", pesoBase: 22, volumeBase: 5.2,
    atributoBase: 'Força', escala: 'D'
  },
  "Espada curva": {
    nome: "Espada curva",
    partes: ["cabo médio", "lâmina curva média"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 0, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 10, danoBase: "d8", pesoBase: 8, volumeBase: 7,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Tanto": {
    nome: "Tanto",
    partes: ["cabo pequeno", "lâmina pequena", "Guarda tsuba pequena"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 10, danoBase: "d6", pesoBase: 2.3, volumeBase: 3.5,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Katar": {
    nome: "Katar",
    partes: ["empunhadura de katar", "lâmina média"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 1,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 10, danoBase: "1d8+1d6", pesoBase: 7.5, volumeBase: 5,
    atributoBase: 'Força', escala: 'D'
  },
  "Pilum": {
    nome: "Pilum",
    partes: ["haste", "ponta de pilum"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 2,
    durabilidadeMult: 0, durabilidadeBonus: 0,
    acertoBase: 14, danoBase: "2d8", pesoBase: 16, volumeBase: 13,
    atributoBase: 'Força', escala: 'D'
  },
  "Adaga antiarmadura": {
    nome: "Adaga antiarmadura",
    partes: ["cabo pequeno", "lâmina média fina"],
    corteMult: 2/3, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 2,
    durabilidadeMult: 1, durabilidadeBonus: -2,
    acertoBase: 10, danoBase: "2d4", pesoBase: 3.5, volumeBase: 5,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Adaga quebra espada": {
    nome: "Adaga quebra espada",
    partes: ["cabo pequeno", "lâmina pequena"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: -1,
    acertoBase: 10, danoBase: "2d4", pesoBase: 1.5, volumeBase: 3,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Arco curto": {
    nome: "Arco curto",
    partes: ["arco curto", "linha"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "2d4", pesoBase: 12, volumeBase: 13,
    atributoBase: 'Destreza', escala: 'C'
  },
  "Arco longo": {
    nome: "Arco longo",
    partes: ["arco longo", "linha"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 10, danoBase: "2d6", pesoBase: 23, volumeBase: 19,
    atributoBase: 'Destreza', escala: 'C'
  },
  "Arco recurvo": {
    nome: "Arco recurvo",
    partes: ["arco recurvo", "linha"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 1,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "2d4", pesoBase: 13, volumeBase: 14,
    atributoBase: 'Destreza', escala: 'C'
  },
  "Urumi": {
    nome: "Urumi",
    partes: ["lâmina de urumi", "cabo"],
    corteMult: 2/3, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 0, perfuracaoBonus: 0,
    durabilidadeMult: 2/3, durabilidadeBonus: 0,
    acertoBase: 8, danoBase: "d8", pesoBase: 12, volumeBase: 10,
    atributoBase: 'Destreza', escala: 'C'
  },
  "Mambele": {
    nome: "Mambele",
    partes: ["Lâmina de mambele", "cabo"],
    corteMult: 1, corteBonus: 0,
    impactoMult: 1/5, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 14, danoBase: "1d8", pesoBase: 6, volumeBase: 4,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Pistola flintlock": {
    nome: "Pistola flintlock",
    partes: ["cano", "mecanismo flintlock", "coronha"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 2, durabilidadeBonus: 0,
    acertoBase: 16, danoBase: "2d10", pesoBase: 12, volumeBase: 4,
    atributoBase: 'Destreza', escala: 'A'
  },
  "Revólver": {
    nome: "Revólver",
    partes: ["cano", "tambor", "mecanismo de revolver", "armação"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 2, durabilidadeBonus: 0,
    acertoBase: 14, danoBase: "3d8", pesoBase: 10, volumeBase: 4,
    atributoBase: 'Destreza', escala: 'A'
  },
  "Rifle flintlock": {
    nome: "Rifle flintlock",
    partes: ["cano longo", "mecanismo flintlock", "coronha"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 2, durabilidadeBonus: 0,
    acertoBase: 14, danoBase: "3d8", pesoBase: 40, volumeBase: 14,
    atributoBase: 'Destreza', escala: 'A'
  },
  "Rifle": {
    nome: "Rifle",
    partes: ["cano longo", "mecanismo de cartucho", "armação"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 2, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "4d8", pesoBase: 40, volumeBase: 12,
    atributoBase: 'Destreza', escala: 'A'
  },
  "Espingarda dupla": {
    nome: "Espingarda dupla",
    partes: ["cano médio duplo", "mecanismo de percussão", "coronha"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1.5, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "5d8", pesoBase: 30, volumeBase: 13,
    atributoBase: 'Destreza', escala: 'A'
  },
  "Pistola de pulso": {
    nome: "Pistola de pulso",
    partes: ["Mecanismo de pulso"],
    corteMult: 0, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 1, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 14, danoBase: "2d8", pesoBase: 5, volumeBase: 3,
    atributoBase: 'Destreza', escala: 'A'
  },
  "Faca de arremesso": {
    nome: "Faca de arremesso",
    partes: ["Maciça"],
    corteMult: 2/3, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "1d4", pesoBase: 0.8, volumeBase: 0.8,
    atributoBase: 'Destreza', escala: 'D'
  },
  "Shuriken": {
    nome: "Shuriken",
    partes: ["Maciça"],
    corteMult: 2/3, corteBonus: 0,
    impactoMult: 0, impactoBonus: 0,
    perfuracaoMult: 2/3, perfuracaoBonus: 0,
    durabilidadeMult: 1, durabilidadeBonus: 0,
    acertoBase: 12, danoBase: "1d4", pesoBase: 0.3, volumeBase: 0.4,
    atributoBase: 'Destreza', escala: 'D'
  }
};

export const createWeaponFromMaterial = (formulaKey: string, material: MaterialData): Weapon => {
  const formula = WEAPON_FORMULAS[formulaKey] || WEAPON_FORMULAS["Espada curta"];
  
  const corte = Math.floor(material.corte.fisico * formula.corteMult + formula.corteBonus);
  const impacto = Math.floor(material.impacto.fisico * formula.impactoMult + formula.impactoBonus);
  const perfuracao = Math.floor(material.perfuracao.fisico * formula.perfuracaoMult + formula.perfuracaoBonus);
  
  let durabilidadeBase = parseInt(material.durabilidade);
  if (isNaN(durabilidadeBase)) durabilidadeBase = 5;
  const durabilidade = Math.max(1, Math.floor(durabilidadeBase * formula.durabilidadeMult + formula.durabilidadeBonus));

  let finalPeso = formula.pesoBase;
  if (material.isPesado) finalPeso *= 2;
  if (material.isLeve) finalPeso /= 2;

  return {
    id: crypto.randomUUID(),
    nome: `${formula.nome} de ${material.nome}`,
    dano: formula.danoBase,
    acerto: formula.acertoBase,
    tipo: formula.nome,
    escala: formula.escala,
    atributoBase: formula.atributoBase,
    peso: Number(finalPeso.toFixed(2)),
    volume: formula.volumeBase,
    durabilidade: durabilidade,
    maxDurabilidade: durabilidade,
    corte,
    impacto,
    perfuracao,
    resistencia: material.resistencia.fisico,
    efeito: material.efeitos.join(", ")
  };
};
