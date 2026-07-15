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
  let lastSerialized = '';

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
        const serialized = JSON.stringify(campaigns);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(campaigns);
        }
      }
    } catch (e) {
      console.warn("[Supabase subscribeToMasterCampaigns] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    fetchAndNotify();
  }, 4000);

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

export const joinCampaign = async (inviteCode: string, playerEmail: string) => {
  if (!playerEmail) {
    throw new Error('Você precisa estar autenticado com um email válido.');
  }

  const { data, error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .select('*')
    .eq('invite_code', inviteCode);
  
  if (error || !data || data.length === 0) {
    throw new Error('Código de convite inválido.');
  }

  const campaignRow = data[0];
  const campaignId = campaignRow.id;
  const campData = campaignRow.data || {};
  const playerEmails = campData.playerEmails || [];

  if (!playerEmails.includes(playerEmail)) {
    playerEmails.push(playerEmail);
  }

  const updatedCampData = {
    ...campData,
    playerEmails,
  };

  try {
    const { error: updateError } = await supabase
      .from(CAMPAIGNS_TABLE)
      .upsert({
        id: campaignId,
        master_id: campaignRow.master_id,
        master_email: campaignRow.master_email || "",
        name: campaignRow.name || campData.name || "Sem Nome",
        invite_code: campaignRow.invite_code || inviteCode,
        data: updatedCampData,
        updated_at: new Date().toISOString()
      });

    if (updateError) throw updateError;
    return campaignId;
  } catch (error) {
    console.error("[Supabase joinCampaign] Failed:", error);
    throw error;
  }
};

export const leaveCampaign = async (campaignId: string, playerEmail: string) => {
  if (!playerEmail) return;

  try {
    const { data, error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .select('*')
      .eq('id', campaignId);

    if (error || !data || data.length === 0) return;

    const campaignRow = data[0];
    const campData = campaignRow.data || {};
    let playerEmails = campData.playerEmails || [];
    playerEmails = playerEmails.filter((email: string) => email !== playerEmail);

    const updatedCampData = {
      ...campData,
      playerEmails,
    };

    const { error: updateError } = await supabase
      .from(CAMPAIGNS_TABLE)
      .upsert({
        id: campaignId,
        master_id: campaignRow.master_id,
        master_email: campaignRow.master_email || "",
        name: campaignRow.name || campData.name || "Sem Nome",
        invite_code: campaignRow.invite_code,
        data: updatedCampData,
        updated_at: new Date().toISOString()
      });

    if (updateError) throw updateError;
  } catch (error) {
    console.error("[Supabase leaveCampaign] Failed:", error);
  }
};

export const subscribeToJoinedCampaigns = (userEmail: string, onUpdate: (campaigns: Campaign[]) => void) => {
  if (!userEmail) {
    onUpdate([]);
    return () => {};
  }

  let active = true;
  let lastSerialized = '';

  const fetchAndNotify = async () => {
    try {
      const { data, error } = await supabase
        .from(CAMPAIGNS_TABLE)
        .select('*');

      if (error) {
        console.warn("[Supabase subscribeToJoinedCampaigns] Info/Error:", error);
        return;
      }

      if (active && data) {
        const campaigns = data
          .map(row => mapRowToCampaign(row))
          .filter(camp => {
            const playerEmails = (camp as any).playerEmails || [];
            return playerEmails.includes(userEmail);
          });
        
        const serialized = JSON.stringify(campaigns);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(campaigns);
        }
      }
    } catch (e) {
      console.warn("[Supabase subscribeToJoinedCampaigns] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    fetchAndNotify();
  }, 4000);

  const localListener = () => {
    fetchAndNotify();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
  }

  const channel = supabase
    .channel(`campaigns_joined_${userEmail}`)
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
  let lastSerialized = '';

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
        const serialized = JSON.stringify(campaigns);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(campaigns);
        }
      }
    } catch (e) {
      console.warn("[Supabase subscribeToCampaignsByIds] Exception handled gracefully:", e);
    }
  };

  fetchAndNotify();

  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    fetchAndNotify();
  }, 4000);

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
  let currentUnsubscribe: (() => void) | null = null;

  const fetchCampaignAndSubscribe = async () => {
    try {
      const { data: campRow, error: campError } = await supabase
        .from(CAMPAIGNS_TABLE)
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campError || !campRow) {
        console.warn("[subscribeToCampaignCharacters] Campaign not found:", campaignId);
        return;
      }

      if (!active) return;

      const campaign = mapRowToCampaign(campRow);
      const playerEmails = campaign.playerEmails || [];
      const masterEmail = campaign.masterEmail || "";
      const allowedEmails = Array.from(new Set([masterEmail, ...playerEmails].filter(Boolean)));

      if (allowedEmails.length === 0) {
        notifyCampaignCharListeners(campaignId, []);
        return;
      }

      const q = query(collection(db, CHARACTERS_TABLE));

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
              
              if (char.userEmail && allowedEmails.includes(char.userEmail)) {
                characters.push(char);
              }
            }
          });
          saveLocalCampaignCharacters(campaignId, characters);
          notifyCampaignCharListeners(campaignId, characters);
        } catch (e) {
          console.error("[subscribeToCampaignCharacters onSnapshot] Error:", e);
        }
      }, (error) => {
        console.error("[subscribeToCampaignCharacters onSnapshot] Listener error:", error);
      });

      currentUnsubscribe = unsubscribe;
    } catch (err) {
      console.error("Error setting up real-time campaign characters:", err);
    }
  };

  fetchCampaignAndSubscribe();

  return () => {
    const listeners = campaignCharListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        campaignCharListeners.delete(campaignId);
      }
    }
    active = false;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }
  };
};
