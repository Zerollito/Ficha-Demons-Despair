import { supabase } from '../lib/supabase';
import { Spell } from '../types';

export const subscribeToSpellsLibrary = (masterId: string, callback: (spells: Spell[]) => void) => {
  if (!masterId) {
    callback([]);
    return () => {};
  }

  let active = true;

  const fetchAndNotify = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_spells')
        .select('data')
        .eq('master_id', masterId);

      if (error) {
        console.warn("[Supabase subscribeToSpellsLibrary] Info/Error:", error);
        return;
      }

      if (active && data) {
        const spells = data.map(item => item.data as Spell);
        callback(spells);
      }
    } catch (e) {
      console.warn("[Supabase subscribeToSpellsLibrary] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const channel = supabase
    .channel(`custom_spells_sync_${masterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'custom_spells',
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

export const saveSpellToLibrary = async (masterId: string, spell: Spell) => {
  try {
    const { error } = await supabase
      .from('custom_spells')
      .upsert({
        id: spell.id,
        master_id: masterId,
        data: spell,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase saveSpellToLibrary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase saveSpellToLibrary] Failed:", error);
    throw error;
  }
};

export const saveSpellsBatch = async (masterId: string, spells: Spell[]) => {
  try {
    const itemsToInsert = spells.map(spell => ({
      id: spell.id,
      master_id: masterId,
      data: spell,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('custom_spells')
      .upsert(itemsToInsert);

    if (error) {
      console.error("[Supabase saveSpellsBatch] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase saveSpellsBatch] Failed:", error);
    throw error;
  }
};

export const deleteSpellFromLibrary = async (spellId: string) => {
  try {
    const { error } = await supabase
      .from('custom_spells')
      .delete()
      .eq('id', spellId);

    if (error) {
      console.error("[Supabase deleteSpellFromLibrary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase deleteSpellFromLibrary] Failed:", error);
    throw error;
  }
};
