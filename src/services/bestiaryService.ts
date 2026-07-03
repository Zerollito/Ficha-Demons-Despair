import { supabase, auth } from "../lib/supabase";
import { BestiaryMonster } from "../types";

export const saveMonsterToBestiary = async (monster: BestiaryMonster) => {
  if (!auth.currentUser) return;
  
  try {
    const { error } = await supabase
      .from('bestiary')
      .upsert({
        id: monster.id,
        master_id: auth.currentUser.uid,
        name: monster.name || 'Sem Nome',
        data: {
          ...monster,
          masterId: auth.currentUser.uid,
          createdAt: monster.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase saveMonsterToBestiary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase saveMonsterToBestiary] Failed:", error);
  }
};

export const deleteMonsterFromBestiary = async (monsterId: string) => {
  if (!auth.currentUser) return;

  try {
    const { error } = await supabase
      .from('bestiary')
      .delete()
      .eq('id', monsterId);

    if (error) {
      console.error("[Supabase deleteMonsterFromBestiary] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase deleteMonsterFromBestiary] Failed:", error);
    throw error;
  }
};

export const subscribeToBestiary = (masterId: string, callback: (monsters: BestiaryMonster[]) => void) => {
  if (!masterId) {
    callback([]);
    return () => {};
  }

  let active = true;

  const fetchAndNotify = async () => {
    try {
      const { data, error } = await supabase
        .from('bestiary')
        .select('data')
        .eq('master_id', masterId)
        .order('name', { ascending: true });

      if (error) {
        console.warn("[Supabase subscribeToBestiary] Info fetching:", error);
        return;
      }

      if (active && data) {
        const monsters = data.map(item => item.data as BestiaryMonster);
        callback(monsters);
      }
    } catch (e) {
      console.warn("[Supabase subscribeToBestiary] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const channel = supabase
    .channel(`bestiary_sync_${masterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bestiary',
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

export const saveMonstersBatch = async (monsters: BestiaryMonster[]) => {
  if (!auth.currentUser) return;
  const masterId = auth.currentUser.uid;
  
  try {
    const itemsToInsert = monsters.map(monster => ({
      id: monster.id,
      master_id: masterId,
      name: monster.name || 'Sem Nome',
      data: {
        ...monster,
        masterId,
        createdAt: monster.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('bestiary')
      .upsert(itemsToInsert);

    if (error) {
      console.error("[Supabase saveMonstersBatch] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase saveMonstersBatch] Failed:", error);
    throw error;
  }
};
