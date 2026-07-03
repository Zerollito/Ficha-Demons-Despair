import { supabase } from '../lib/supabase';
import { MaterialData } from '../data/materials';

export const subscribeToMaterials = (masterId: string, callback: (materials: MaterialData[]) => void) => {
  let active = true;

  const fetchAndNotify = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('data')
        .eq('master_id', masterId);

      if (error) {
        console.warn("[Supabase subscribeToMaterials] Info/Error:", error);
        return;
      }

      if (active && data) {
        const materials = data.map(item => item.data as MaterialData);
        callback(materials);
      }
    } catch (e) {
      console.warn("[Supabase subscribeToMaterials] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const channel = supabase
    .channel(`materials_sync_${masterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'materials',
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

export const saveMaterial = async (masterId: string, material: MaterialData) => {
  try {
    const { error } = await supabase
      .from('materials')
      .upsert({
        id: material.id,
        master_id: masterId,
        data: material,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase saveMaterial] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase saveMaterial] Failed:", error);
  }
};

export const deleteMaterial = async (materialId: string) => {
  try {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId);

    if (error) {
      console.error("[Supabase deleteMaterial] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase deleteMaterial] Failed:", error);
    throw error;
  }
};
