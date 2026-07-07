import { supabase, auth, db, isFirebaseQuotaExceeded, handleFirestoreError, collection, query, where, onSnapshot } from '../lib/supabase';
import { Campaign, Character } from '../types';
import { generateInviteCode } from '../lib/random';

const CAMPAIGNS_TABLE = 'campaigns';
const CHARACTERS_TABLE = 'characters';

export const createCampaign = async (name: string) => {
  if (!auth.currentUser) {
    throw new Error("Você precisa estar autenticado para criar uma campanha.");
  }

  const inviteCode = generateInviteCode();
  const campaignData = {
    name,
    masterId: auth.currentUser.uid,
    masterEmail: auth.currentUser.email,
    inviteCode,
    createdAt: new Date().toISOString()
  };

  try {
    const id = "camp_" + Math.random().toString(36).substring(2, 11);
    const { error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .insert({
        id,
        master_id: auth.currentUser.uid,
        master_email: auth.currentUser.email || "",
        name,
        invite_code: inviteCode,
        data: campaignData,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return { id, ...campaignData } as Campaign;
  } catch (error: any) {
    console.error("[Supabase createCampaign] Error:", error);
    throw new Error(error?.message || "Erro desconhecido ao criar campanha.");
  }
};

export const mapRowToCampaign = (row: any): Campaign => {
  const campData = row.data || {};
  return {
    ...campData,
    id: row.id,
    name: row.name || campData.name || "Sem Nome",
    masterId: row.master_id || campData.masterId || "",
    masterEmail: row.master_email || campData.masterEmail || "",
    inviteCode: row.invite_code || row.inviteCode || campData.inviteCode || "",
    createdAt: row.created_at || row.createdAt || campData.createdAt || null,
  };
};

export const subscribeToMasterCampaigns = (onUpdate: (campaigns: Campaign[]) => void) => {
  if (!auth.currentUser) return () => {};

  const userId = auth.currentUser.uid;
  const userEmail = auth.currentUser.email || "";
  let active = true;

  const fetchAndNotify = async () => {
    try {
      let queryBuilder = supabase.from(CAMPAIGNS_TABLE).select('*');
      if (userEmail) {
        queryBuilder = queryBuilder.or(`master_email.eq.${userEmail},master_id.eq.${userId}`);
      } else {
        queryBuilder = queryBuilder.eq('master_id', userId);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.warn("[Supabase subscribeToMasterCampaigns] Info/Error:", error);
        return;
      }

      if (active && data) {
        const campaigns = data.map(row => mapRowToCampaign(row));
        onUpdate(campaigns);
      }
    } catch (e) {
      console.warn("[Supabase subscribeToMasterCampaigns] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const interval = setInterval(fetchAndNotify, 4000);

  const localListener = () => {
    fetchAndNotify();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
  }

  const channel = supabase
    .channel(`campaigns_master_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: CAMPAIGNS_TABLE
      },
      () => {
        fetchAndNotify();
      }
    )
    .subscribe();

  return () => {
    active = false;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
    }
    supabase.removeChannel(channel);
  };
};

export const joinCampaign = async (characterId: string, inviteCode: string) => {
  const { data, error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .select('id')
    .eq('invite_code', inviteCode);
  
  if (error || !data || data.length === 0) {
    throw new Error('Código de convite inválido.');
  }

  const campaignId = data[0].id;

  try {
    const { data: charData, error: charError } = await supabase
      .from(CHARACTERS_TABLE)
      .select('data')
      .eq('id', characterId)
      .single();

    if (charError || !charData) {
      throw new Error('Personagem não encontrado.');
    }

    const updatedChar = { 
      ...charData.data, 
      campaignId, 
      userEmail: auth.currentUser?.email || null,
      updatedAt: new Date().toISOString() 
    };

    const { error: updateError } = await supabase
      .from(CHARACTERS_TABLE)
      .upsert({
        id: characterId,
        user_id: auth.currentUser?.uid || charData.data.userId,
        user_email: auth.currentUser?.email || null,
        campaign_id: campaignId,
        data: updatedChar,
        updated_at: new Date().toISOString()
      });

    if (updateError) throw updateError;
    return campaignId;
  } catch (error) {
    console.error("[Supabase joinCampaign] Failed:", error);
    throw error;
  }
};

export const deleteCampaign = async (campaignId: string) => {
  if (!auth.currentUser) return;

  try {
    const { error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .delete()
      .eq('id', campaignId);

    if (error) {
      console.error("[Supabase deleteCampaign] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase deleteCampaign] Failed:", error);
    throw error;
  }
};

export const subscribeToCampaignsByIds = (campaignIds: string[], onUpdate: (campaigns: Campaign[]) => void) => {
  if (campaignIds.length === 0) {
    onUpdate([]);
    return () => {};
  }

  let active = true;

  const fetchAndNotify = async () => {
    try {
      const { data, error } = await supabase
        .from(CAMPAIGNS_TABLE)
        .select('*')
        .in('id', campaignIds);

      if (error) {
        console.warn("[Supabase subscribeToCampaignsByIds] Info/Error:", error);
        return;
      }

      if (active && data) {
        const campaigns = data.map(row => mapRowToCampaign(row));
        onUpdate(campaigns);
      }
    } catch (e) {
      console.warn("[Supabase subscribeToCampaignsByIds] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const interval = setInterval(fetchAndNotify, 4000);

  const localListener = () => {
    fetchAndNotify();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
  }

  const channel = supabase
    .channel(`campaigns_by_ids_${campaignIds.slice(0, 5).join('_')}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: CAMPAIGNS_TABLE
      },
      () => {
        fetchAndNotify();
      }
    )
    .subscribe();

  return () => {
    active = false;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
    }
    supabase.removeChannel(channel);
  };
};

const campaignCharListeners = new Map<string, Set<(characters: Character[]) => void>>();

export const getLocalCampaignCharacters = (campaignId: string): Character[] => {
  try {
    const stored = localStorage.getItem(`campaign_characters_${campaignId}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Error reading local campaign characters:", e);
  }
  return [];
};

export const saveLocalCampaignCharacters = (campaignId: string, characters: Character[]) => {
  try {
    localStorage.setItem(`campaign_characters_${campaignId}`, JSON.stringify(characters));
  } catch (e) {
    console.error("Error saving local campaign characters:", e);
  }
};

export const notifyCampaignCharListeners = (campaignId: string, characters: Character[]) => {
  const listeners = campaignCharListeners.get(campaignId);
  if (listeners) {
    listeners.forEach(cb => {
      try { cb(characters); } catch (e) { console.error(e); }
    });
  }
};

export const subscribeToCampaignCharacters = (campaignId: string, onUpdate: (characters: Character[]) => void) => {
  if (!campaignCharListeners.has(campaignId)) {
    campaignCharListeners.set(campaignId, new Set());
  }
  campaignCharListeners.get(campaignId)!.add(onUpdate);

  // Return local immediately so sheets and lists work even under quota limits
  const localChars = getLocalCampaignCharacters(campaignId);
  onUpdate(localChars);

  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Campaign] Firestore quota exceeded. Skipping snapshot listener for campaign characters.");
    return () => {
      const listeners = campaignCharListeners.get(campaignId);
      if (listeners) {
        listeners.delete(onUpdate);
        if (listeners.size === 0) {
          campaignCharListeners.delete(campaignId);
        }
      }
    };
  }

  let active = true;

  const q = query(
    collection(db, CHARACTERS_TABLE),
    where('campaign_id', '==', campaignId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active) return;
    try {
      const characters: Character[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData && docData.data) {
          const char = { ...docData.data } as Character;
          if (!char.userId && docData.user_id) char.userId = docData.user_id;
          if (!char.userEmail && docData.user_email) char.userEmail = docData.user_email;
          characters.push(char);
        }
      });
      saveLocalCampaignCharacters(campaignId, characters);
      notifyCampaignCharListeners(campaignId, characters);
    } catch (e) {
      console.error("[subscribeToCampaignCharacters onSnapshot] Error:", e);
    }
  }, (error) => {
    console.error("[subscribeToCampaignCharacters onSnapshot] Listener error:", error);
    try {
      handleFirestoreError(error, 'get', CHARACTERS_TABLE);
    } catch (err) {
      // Ignora erro relançado para não quebrar a aplicação
    }
  });

  return () => {
    const listeners = campaignCharListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        campaignCharListeners.delete(campaignId);
      }
    }
    active = false;
    unsubscribe();
  };
};
