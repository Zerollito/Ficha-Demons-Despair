import { supabase, auth, db, isFirebaseQuotaExceeded, handleFirestoreError, collection, query, where, onSnapshot, safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/supabase';
import { Campaign, Character } from '../types';
import { generateInviteCode } from '../lib/random';
import { getDeletedCharactersBlacklist } from './characterService';

const CAMPAIGNS_TABLE = 'campaigns';
const CHARACTERS_TABLE = 'characters';

export const createCampaign = async (name: string) => {
  const userEmail = (auth.currentUser?.email || "").trim().toLowerCase();
  if (!userEmail) {
    throw new Error("Você precisa estar autenticado para criar uma campanha.");
  }

  const inviteCode = generateInviteCode();
  const campaignData: Partial<Campaign> = {
    name,
    masterId: auth.currentUser?.uid || userEmail,
    masterEmail: userEmail,
    inviteCode,
    createdAt: new Date().toISOString(),
    playerEmails: [userEmail]
  };

  try {
    const id = "camp_" + Math.random().toString(36).substring(2, 11);
    const newCamp = { id, ...campaignData } as Campaign;

    // 1. Salvar no servidor local / backend
    try {
      fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCamp)
      }).catch(() => {});
    } catch (e) {}

    // 2. Salvar no Supabase
    const { error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .insert({
        id,
        master_id: auth.currentUser?.uid || userEmail,
        master_email: userEmail,
        name,
        invite_code: inviteCode,
        data: campaignData,
        updated_at: new Date().toISOString()
      });

    if (error) console.warn("[Supabase createCampaign] Note:", error);
    return newCamp;
  } catch (error: any) {
    console.error("[createCampaign] Error:", error);
    throw new Error(error?.message || "Erro desconhecido ao criar campanha.");
  }
};

export const mapRowToCampaign = (row: any): Campaign => {
  const campData = row.data || {};
  const masterEmail = (row.master_email || campData.masterEmail || campData.master_email || "").trim().toLowerCase();
  let playerEmails: string[] = campData.playerEmails || row.player_emails || [];
  if (Array.isArray(playerEmails)) {
    playerEmails = playerEmails.map((e: string) => (e || '').trim().toLowerCase());
  } else {
    playerEmails = [];
  }

  return {
    ...campData,
    id: row.id,
    name: row.name || campData.name || "Sem Nome",
    masterId: row.master_id || campData.masterId || masterEmail,
    masterEmail: masterEmail,
    inviteCode: row.invite_code || row.inviteCode || campData.inviteCode || "",
    playerEmails,
    createdAt: row.created_at || row.createdAt || campData.createdAt || null,
  };
};

export const saveCampaign = async (campaign: Campaign) => {
  const userEmail = (campaign.masterEmail || auth.currentUser?.email || "").trim().toLowerCase();
  const masterId = campaign.masterId || auth.currentUser?.uid || userEmail;
  const fullCamp = { ...campaign, masterEmail: userEmail, masterId };

  // 1. Salvar no servidor backend
  try {
    fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullCamp)
    }).catch(() => {});
  } catch (e) {}

  // 2. Salvar no Supabase
  try {
    const { error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .upsert({
        id: campaign.id,
        master_id: masterId,
        master_email: userEmail,
        name: campaign.name || "Sem Nome",
        invite_code: campaign.inviteCode || generateInviteCode(),
        data: fullCamp,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase saveCampaign] Upsert error:", error);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`supabase_local_change_${CAMPAIGNS_TABLE}`));
    }
  } catch (e) {
    console.error("[Supabase saveCampaign] Exception:", e);
  }
};

export const subscribeToMasterCampaigns = (onUpdate: (campaigns: Campaign[]) => void) => {
  const userEmail = (auth.currentUser?.email || "").trim().toLowerCase();
  if (!userEmail) {
    onUpdate([]);
    return () => {};
  }

  let active = true;
  let isFetching = false;
  let lastSerialized = '';

  const fetchAndNotify = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const campMap = new Map<string, Campaign>();

      // 1. Buscar do servidor backend
      try {
        const sRes = await fetch(`/api/campaigns?masterEmail=${encodeURIComponent(userEmail)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData && Array.isArray(sData.campaigns)) {
            sData.campaigns.forEach((c: any) => {
              if (c && c.id) campMap.set(c.id, c);
            });
          }
        }
      } catch (sErr) {}

      // 2. Buscar do Supabase
      const { data, error } = await supabase
        .from(CAMPAIGNS_TABLE)
        .select('*')
        .eq('master_email', userEmail);

      if (!error && data && Array.isArray(data)) {
        data.forEach(row => {
          const mapped = mapRowToCampaign(row);
          if (mapped && mapped.id) {
            campMap.set(mapped.id, mapped);
          }
        });
      }

      if (active) {
        const campaigns = Array.from(campMap.values());
        const serialized = JSON.stringify(campaigns);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(campaigns);
        }
      }
    } catch (e) {
      console.warn("[subscribeToMasterCampaigns] Exception handled gracefully:", e);
    } finally {
      isFetching = false;
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
    .channel(`campaigns_master_${userEmail}`)
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
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
};

export const joinCampaign = async (inviteCode: string, playerEmail: string) => {
  const cleanCode = (inviteCode || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Código de convite não informado.');
  }

  const cleanEmail = (playerEmail || auth.currentUser?.email || auth.currentUser?.uid || 'jogador').trim().toLowerCase();

  let campaignRow: any = null;
  let campaignId = '';

  // 1. Tentar buscar pelo Supabase
  try {
    const { data, error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .select('*')
      .eq('invite_code', cleanCode);
    
    if (!error && data && data.length > 0) {
      campaignRow = data[0];
      campaignId = campaignRow.id;
    }
  } catch (e) {}

  // 2. Se não encontrou no Supabase, buscar na rota /api/campaigns/invite/:inviteCode do servidor backend
  if (!campaignId) {
    try {
      const sRes = await fetch(`/api/campaigns/invite/${encodeURIComponent(cleanCode)}`);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData && sData.campaign) {
          campaignRow = { id: sData.campaign.id, data: sData.campaign, ...sData.campaign };
          campaignId = sData.campaign.id;
        }
      }
    } catch (e) {}
  }

  if (!campaignId || !campaignRow) {
    throw new Error('Código de convite inválido ou campanha não encontrada.');
  }

  const campData = campaignRow.data || campaignRow || {};
  let playerEmails: string[] = campData.playerEmails || campaignRow.player_emails || [];
  if (!Array.isArray(playerEmails)) playerEmails = [];
  playerEmails = playerEmails.map((e: string) => (e || '').trim().toLowerCase());

  if (cleanEmail && !playerEmails.includes(cleanEmail)) {
    playerEmails.push(cleanEmail);
  }

  const updatedCampData = {
    ...campData,
    playerEmails,
  };

  // 3. Registrar no servidor local / backend
  try {
    await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerEmail: cleanEmail })
    });
  } catch (e) {}

  // 4. Registrar no Supabase
  try {
    await supabase
      .from(CAMPAIGNS_TABLE)
      .upsert({
        id: campaignId,
        master_id: campaignRow.master_id || campData.masterId,
        master_email: campaignRow.master_email || campData.masterEmail || "",
        name: campaignRow.name || campData.name || "Sem Nome",
        invite_code: campaignRow.invite_code || cleanCode,
        data: updatedCampData,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn("[joinCampaign] Supabase note:", error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${CAMPAIGNS_TABLE}`));
  }

  return campaignId;
};

export const leaveCampaign = async (campaignId: string, playerEmail: string) => {
  const cleanEmail = (playerEmail || auth.currentUser?.email || auth.currentUser?.uid || '').trim().toLowerCase();
  if (!campaignId) return;

  // 1. Notificar servidor backend
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerEmail: cleanEmail })
    }).catch(() => {});
  } catch (e) {}

  // 2. Atualizar no Supabase
  try {
    const { data, error } = await supabase
      .from(CAMPAIGNS_TABLE)
      .select('*')
      .eq('id', campaignId);

    if (error || !data || data.length === 0) return;

    const campaignRow = data[0];
    const campData = campaignRow.data || {};
    let playerEmails: string[] = campData.playerEmails || campaignRow.player_emails || [];
    if (!Array.isArray(playerEmails)) playerEmails = [];
    playerEmails = playerEmails
      .map((e: string) => (e || '').trim().toLowerCase())
      .filter((email: string) => email !== cleanEmail);

    const updatedCampData = {
      ...campData,
      playerEmails,
    };

    await supabase
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
  } catch (error) {
    console.error("[leaveCampaign] Failed:", error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${CAMPAIGNS_TABLE}`));
  }
};

export const subscribeToJoinedCampaigns = (userEmail: string, onUpdate: (campaigns: Campaign[]) => void) => {
  const cleanEmail = (userEmail || auth.currentUser?.email || auth.currentUser?.uid || '').trim().toLowerCase();
  if (!cleanEmail) {
    onUpdate([]);
    return () => {};
  }

  let active = true;
  let isFetching = false;
  let lastSerialized = '';

  const fetchAndNotify = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const campMap = new Map<string, Campaign>();

      // 1. Buscar do servidor backend
      try {
        const sRes = await fetch(`/api/campaigns?playerEmail=${encodeURIComponent(cleanEmail)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData && Array.isArray(sData.campaigns)) {
            sData.campaigns.forEach((c: any) => {
              if (c && c.id) campMap.set(c.id, c);
            });
          }
        }
      } catch (sErr) {}

      // 2. Buscar do Supabase
      const { data, error } = await supabase
        .from(CAMPAIGNS_TABLE)
        .select('*');

      if (!error && data && Array.isArray(data)) {
        data
          .map(row => mapRowToCampaign(row))
          .filter(camp => {
            const playerEmails = ((camp as any).playerEmails || []).map((e: string) => (e || '').toLowerCase());
            return playerEmails.includes(cleanEmail);
          })
          .forEach(c => {
            if (c && c.id) campMap.set(c.id, c);
          });
      }

      if (active) {
        const campaigns = Array.from(campMap.values());
        const serialized = JSON.stringify(campaigns);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          onUpdate(campaigns);
        }
      }
    } catch (e) {
      console.warn("[subscribeToJoinedCampaigns] Exception handled gracefully:", e);
    } finally {
      isFetching = false;
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
    const stored = safeLocalStorageGetItem(`campaign_characters_${campaignId}`) || localStorage.getItem(`campaign_characters_${campaignId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((c: any) => c && (c.campaignId === campaignId || c.campaign_id === campaignId));
        if (filtered.length !== parsed.length) {
          saveLocalCampaignCharacters(campaignId, filtered);
        }
        return filtered;
      }
    }
  } catch (e) {
    console.warn("Warning reading local campaign characters:", e);
  }
  return [];
};

export const optimizeCharactersForCache = (characters: Character[]): Character[] => {
  if (!characters) return [];
  return characters.map(char => {
    try {
      // 1. Shallow copy
      const optimized = { ...char };
      
      // 2. Clear out the gallery array (imagens) as it's not needed in VTT/campaign summary cache
      if (optimized.imagens && optimized.imagens.length > 0) {
        optimized.imagens = [];
      }
      
      // 3. Strip notes (anotacoes) from campaign cache as they are large and private to the character
      optimized.anotacoes = [];
      
      // 4. Truncate history log in campaign cache
      const optAny = optimized as any;
      if (optAny.historico && Array.isArray(optAny.historico) && optAny.historico.length > 5) {
        optAny.historico = optAny.historico.slice(0, 5);
      }

      // DO NOT erase character avatar (imagem)! It is vital for VTT tokens, character cards, and sheet displays.
      return optimized;
    } catch (err) {
      console.warn("Warning optimizing character for cache:", err);
      return char;
    }
  });
};

export const saveLocalCampaignCharacters = (campaignId: string, characters: Character[]) => {
  try {
    const optimized = optimizeCharactersForCache(characters);
    safeLocalStorageSetItem(`campaign_characters_${campaignId}`, JSON.stringify(optimized));
  } catch (e) {
    console.warn("Warning saving local campaign characters:", e);
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

export const linkCharacterToCampaign = async (campaignId: string, character: Character): Promise<Character> => {
  if (!campaignId || !character || !character.id) {
    throw new Error("Campanha e personagem válidos são obrigatórios para vincular.");
  }

  const linkedChar: Character = {
    ...character,
    campaignId: campaignId
  };

  // 1. Atualizar cache local imediatamente para resposta instantânea
  try {
    const currentLocals = getLocalCampaignCharacters(campaignId);
    const updatedLocals = [...currentLocals.filter(c => c.id !== linkedChar.id), linkedChar];
    saveLocalCampaignCharacters(campaignId, updatedLocals);
    notifyCampaignCharListeners(campaignId, updatedLocals);

    // Também salvar nas tabelas locais de characters
    const tableKey = `supabase_table_${CHARACTERS_TABLE}`;
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(tableKey);
      let list = existing ? JSON.parse(existing) : [];
      if (Array.isArray(list)) {
        list = [...list.filter((c: any) => c.id !== linkedChar.id), { id: linkedChar.id, campaign_id: campaignId, data: linkedChar }];
        localStorage.setItem(tableKey, JSON.stringify(list));
      }
    }
  } catch (e) {
    console.warn("[linkCharacterToCampaign] Cache local warning:", e);
  }

  // Disparar eventos locais
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${CHARACTERS_TABLE}`));
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${CAMPAIGNS_TABLE}`));
    window.dispatchEvent(new CustomEvent('campaign_characters_updated', { detail: { campaignId, character: linkedChar } }));
  }

  // 2. Notificar o servidor backend dedicado (/api/campaigns/:id/characters) e aguardar confirmação
  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: linkedChar })
    });
    if (res.ok) {
      console.log(`[linkCharacterToCampaign] Ficha ${linkedChar.nome} confirmada pelo backend.`);
    }
  } catch (e) {
    console.warn("[linkCharacterToCampaign] Backend fetch notice:", e);
  }

  // 3. Atualizar no banco Supabase
  try {
    const targetUserId = linkedChar.userId || auth.currentUser?.uid || linkedChar.userEmail || "anonymous";
    const userEmail = (linkedChar.userEmail || auth.currentUser?.email || "").trim().toLowerCase();

    await supabase
      .from(CHARACTERS_TABLE)
      .upsert({
        id: linkedChar.id,
        user_id: targetUserId,
        user_email: userEmail,
        campaign_id: campaignId,
        data: linkedChar,
        updated_at: new Date().toISOString()
      });
  } catch (err) {
    console.warn("[linkCharacterToCampaign] Supabase direct upsert warning:", err);
  }

  return linkedChar;
};

export const unlinkCharacterFromCampaign = async (campaignId: string, characterId: string): Promise<void> => {
  if (!campaignId || !characterId) return;

  // 1. Remover do cache local
  try {
    const currentLocals = getLocalCampaignCharacters(campaignId);
    const updatedLocals = currentLocals.filter(c => c.id !== characterId);
    saveLocalCampaignCharacters(campaignId, updatedLocals);
    notifyCampaignCharListeners(campaignId, updatedLocals);
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${CHARACTERS_TABLE}`));
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${CAMPAIGNS_TABLE}`));
  }

  // 2. Chamar endpoint de desvinculação no servidor backend
  try {
    await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/unlink-character`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId })
    });
  } catch (e) {}

  // 3. Desvincular no Supabase
  try {
    await supabase
      .from(CHARACTERS_TABLE)
      .update({ campaign_id: null, updated_at: new Date().toISOString() })
      .eq('id', characterId);
  } catch (err) {}
};

export const subscribeToCampaignCharacters = (campaignId: string, onUpdate: (characters: Character[]) => void) => {
  if (!campaignCharListeners.has(campaignId)) {
    campaignCharListeners.set(campaignId, new Set());
  }
  campaignCharListeners.get(campaignId)!.add(onUpdate);

  // Retorna os dados locais imediatamente para não travar a UI
  const localChars = getLocalCampaignCharacters(campaignId);
  onUpdate(localChars);

  let active = true;
  let lastSerialized = '';

  const fetchAndNotify = async () => {
    if (!active) return;
    try {
      const blacklist = getDeletedCharactersBlacklist();
      const matchedCharacters: Character[] = [];
      const seenIds = new Set<string>();

      // 1. Buscar primeiro da API dedicada do servidor backend (/api/campaigns/:id/characters)
      // Esta rota contorna completamente qualquer RLS do Supabase e lê da persistência em disco do servidor
      try {
        const sRes = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/characters`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData && Array.isArray(sData.characters)) {
            for (const c of sData.characters) {
              if (c && c.id && !blacklist.has(c.id) && !seenIds.has(c.id)) {
                const charCampId = c.campaignId || c.campaign_id || '';
                if (charCampId && charCampId !== campaignId) continue;
                seenIds.add(c.id);
                matchedCharacters.push({ ...c, campaignId: charCampId || campaignId });
              }
            }
          }
        }
      } catch (sErr) {}

      // 2. Obter os dados da campanha para verificar fichas embutidas (playerCharacters)
      try {
        const { data: campRow } = await supabase
          .from(CAMPAIGNS_TABLE)
          .select('*')
          .eq('id', campaignId)
          .single();

        if (campRow) {
          const campData = campRow.data || {};
          const pcs = campData.playerCharacters || (campRow as any).playerCharacters || [];
          if (Array.isArray(pcs)) {
            for (const pc of pcs) {
              if (pc && pc.id && !blacklist.has(pc.id) && !seenIds.has(pc.id)) {
                seenIds.add(pc.id);
                matchedCharacters.push({ ...pc, campaignId });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[subscribeToCampaignCharacters] Camp row fetch warning:", err);
      }

      // 2.1 Também conferir no endpoint /api/campaigns/:id
      try {
        const cRes = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          const camp = cData?.campaign;
          if (camp && Array.isArray(camp.playerCharacters)) {
            for (const pc of camp.playerCharacters) {
              if (pc && pc.id && !blacklist.has(pc.id) && !seenIds.has(pc.id)) {
                seenIds.add(pc.id);
                matchedCharacters.push({ ...pc, campaignId });
              }
            }
          }
        }
      } catch (e) {}

      // 3. Buscar fichas do banco de dados estritamente pelo campaign_id
      try {
        const { data: charRows } = await supabase
          .from(CHARACTERS_TABLE)
          .select('*')
          .eq('campaign_id', campaignId);

        if (charRows && Array.isArray(charRows)) {
          for (const docData of charRows) {
            if (!docData) continue;
            let charData: any = docData.data;
            if (typeof charData === 'string') {
              try { charData = JSON.parse(charData); } catch (e) { charData = docData; }
            } else if (!charData || typeof charData !== 'object') {
              charData = docData;
            }

            const char = { ...docData, ...charData } as Character;
            if (!char.userId && docData.user_id) char.userId = docData.user_id;
            if (!char.userEmail && docData.user_email) char.userEmail = docData.user_email;

            if (!char.id || blacklist.has(char.id) || seenIds.has(char.id)) continue;

            const charCampId = char.campaignId || docData.campaign_id || '';
            if (charCampId && charCampId !== campaignId) continue;

            seenIds.add(char.id);
            matchedCharacters.push({ ...char, campaignId: charCampId || campaignId });
          }
        }
      } catch (charFetchErr) {}

      // 4. Incluir fichas salvas localmente no navegador que pertencem estritamente a esta campanha
      const rawLocalCached = getLocalCampaignCharacters(campaignId);
      const validLocalCached = rawLocalCached.filter(lc => {
        if (!lc || !lc.id || blacklist.has(lc.id)) return false;
        const lcCampId = lc.campaignId || (lc as any).campaign_id || '';
        if (lcCampId && lcCampId !== campaignId) return false;
        return true;
      });
      if (rawLocalCached.length !== validLocalCached.length) {
        saveLocalCampaignCharacters(campaignId, validLocalCached);
      }
      for (const lc of validLocalCached) {
        if (!seenIds.has(lc.id)) {
          seenIds.add(lc.id);
          const lcCampId = lc.campaignId || (lc as any).campaign_id || '';
          if (!lcCampId || lcCampId === campaignId) {
            matchedCharacters.push({ ...lc, campaignId: lcCampId || campaignId });
          }
        }
      }

      // 5. Salvar em cache local e notificar ouvintes
      saveLocalCampaignCharacters(campaignId, matchedCharacters);
      const serialized = JSON.stringify(matchedCharacters);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        notifyCampaignCharListeners(campaignId, matchedCharacters);
      }
    } catch (e) {
      console.error("[subscribeToCampaignCharacters] Error:", e);
    }
  };

  fetchAndNotify();

  // Escutar eventos locais de mudanças em personagens e campanhas
  const localListener = () => {
    fetchAndNotify();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(`supabase_local_change_${CHARACTERS_TABLE}`, localListener);
    window.addEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
    window.addEventListener('campaign_characters_updated', localListener);
  }

  // Polling a cada 2.5s para manter dados atualizados
  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    fetchAndNotify();
  }, 2500);

  return () => {
    active = false;
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener(`supabase_local_change_${CHARACTERS_TABLE}`, localListener);
      window.removeEventListener(`supabase_local_change_${CAMPAIGNS_TABLE}`, localListener);
      window.removeEventListener('campaign_characters_updated', localListener);
    }
    const listeners = campaignCharListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        campaignCharListeners.delete(campaignId);
      }
    }
  };
};
