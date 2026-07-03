import { supabase } from '../lib/supabase';
import { Item } from '../rules/inventoryRules';

export const subscribeToItemsLibrary = (masterId: string, callback: (items: Item[]) => void) => {
  if (!masterId) {
    callback([]);
    return () => {};
  }

  let active = true;

  const fetchAndNotify = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_items')
        .select('data')
        .eq('master_id', masterId);

      if (error) {
        console.warn("[Supabase subscribeToItemsLibrary] Info/Error:", error);
        return;
      }

      if (active && data) {
        const items = data.map(item => item.data as Item);
        callback(items);
      }
    } catch (e) {
      console.warn("[Supabase subscribeToItemsLibrary] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const channel = supabase
    .channel(`custom_items_sync_${masterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'custom_items',
        filter: `master_id=eq.${masterId}`
      },
      () => {
        fetchAndNotify();
      }
    )
    .subscribe();

  return () => {
    active = false;
    supabase.removeChannel(channel);
  };
};

export const saveItemToLibrary = async (masterId: string, item: Item) => {
  try {
    const { error } = await supabase
      .from('custom_items')
      .upsert({
        id: item.id,
        master_id: masterId,
        data: item,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase saveItemToLibrary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase saveItemToLibrary] Failed:", error);
  }
};

export const deleteItemFromLibrary = async (itemId: string) => {
  try {
    const { error } = await supabase
      .from('custom_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error("[Supabase deleteItemFromLibrary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase deleteItemFromLibrary] Failed:", error);
    throw error;
  }
};
