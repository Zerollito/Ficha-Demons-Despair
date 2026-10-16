import { SpellData } from '../data/spells';

export const saveSpellToLibrary = async (spell: SpellData) => {
  try {
    const saved = localStorage.getItem('demons_despair_custom_spells');
    const spells: SpellData[] = saved ? JSON.parse(saved) : [];
    const exists = spells.some(s => s.nome === spell.nome && s.escola === spell.escola);
    if (!exists) {
      spells.unshift(spell);
      localStorage.setItem('demons_despair_custom_spells', JSON.stringify(spells));
    }
    return { success: true };
  } catch (err) {
    console.error("Erro ao salvar magia na biblioteca:", err);
    return { success: false, error: err };
  }
};
