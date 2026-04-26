import { Character } from '../types';
import { INITIAL_KNOWLEDGES } from '../rules/knowledgeRules';

export const createEmptyCharacter = (): Character => ({
  id: crypto.randomUUID(),
  userId: '',
  nome: 'Novo Personagem',
  etnia: '',
  dinheiro: { C: 0, B: 0, P: 0, O: 0 },
  vidaAtual: 0,
  manaAtual: 0,
  fome: 100,
  sede: 100,
  cansaco: 8,
  defesa: { Cabeça: 0, Torso: 0, Braços: 0, Pernas: 0 },
  clima: 0,
  stats: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
  statsXP: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
  joias: [],
  imagem: '',
  armas: [],
  catalisadores: [],
  habilidades: [],
  magias: [],
  armaduras: [],
  acessorios: [],
  compartimentos: [
    { id: crypto.randomUUID(), nome: 'Mochila de Viagem', volumeMax: 30, itens: [] },
    { id: crypto.randomUUID(), nome: 'Bolsa de Cinto', volumeMax: 3, itens: [] }
  ],
  conhecimentos: INITIAL_KNOWLEDGES.map(name => ({ name, nivel: 0, xp: 0, limite: 5 })),
  escalas: [],
  efeitosNegativos: [],
  anotacoes: [{ id: crypto.randomUUID(), titulo: 'Anotações Gerais', conteudo: '' }],
  dadosCustomizados: [],
  imagens: [],
});
