import { Item } from '../data/items';

export const saveItemToLibrary = async (item: Item) => {
  try {
    const saved = localStorage.getItem('demons_despair_custom_items');
    const items: Item[] = saved ? JSON.parse(saved) : [];
    const exists = items.some(i => i.nome === item.nome && i.descricao === item.descricao);
    if (!exists) {
      items.unshift(item);
      localStorage.setItem('demons_despair_custom_items', JSON.stringify(items));
    }
    return { success: true };
  } catch (err) {
    console.error("Erro ao salvar item na biblioteca:", err);
    return { success: false, error: err };
  }
};
