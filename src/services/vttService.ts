import { supabase, db, isFirebaseQuotaExceeded, handleFirestoreError, collection, query, where, onSnapshot, safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/supabase';
import { TableToken, TableConfig } from '../types';

// Helper to generate IDs
const generateLocalId = () => Math.random().toString(36).substring(2, 11);

// Local Pub-Sub and Cache Stores
const tokenListeners = new Map<string, Set<(tokens: TableToken[]) => void>>();
const configListeners = new Map<string, Set<(config: TableConfig) => void>>();
const logListeners = new Map<string, Set<(logs: any[]) => void>>();

export const getLocalTokens = (campaignId: string): TableToken[] => {
  try {
    const stored = safeLocalStorageGetItem(`vtt_tokens_${campaignId}`) || localStorage.getItem(`vtt_tokens_${campaignId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Warning reading local tokens:", e);
  }

  // Fallback recovery from supabase_table_tokens
  try {
    const tableData = safeLocalStorageGetItem('supabase_table_tokens') || localStorage.getItem('supabase_table_tokens');
    if (tableData) {
      const list = JSON.parse(tableData);
      const campTokens: TableToken[] = [];
      list.forEach((r: any) => {
        const rowCampId = r.campaign_id || r.campaignId || r.data?.campaign_id || r.data?.campaignId;
        if (rowCampId === campaignId) {
          let tk = r.data !== undefined ? r.data : r;
          if (typeof tk === 'string') {
            try { tk = JSON.parse(tk); } catch (e) {}
          }
          if (tk && typeof tk === 'object') {
            campTokens.push({ ...tk, id: tk.id || r.id });
          }
        }
      });
      if (campTokens.length > 0) {
        return campTokens;
      }
    }
  } catch (e) {}

  return [];
};

export const saveLocalTokens = (campaignId: string, tokens: TableToken[]) => {
  try {
    safeLocalStorageSetItem(`vtt_tokens_${campaignId}`, JSON.stringify(tokens));
    
    // Also mirror to supabase_table_tokens for offline query consistency
    try {
      const tableData = safeLocalStorageGetItem('supabase_table_tokens') || localStorage.getItem('supabase_table_tokens');
      let list = tableData ? JSON.parse(tableData) : [];
      // Remove previous tokens for this campaign and insert updated ones
      list = list.filter((r: any) => {
        const rowCampId = r.campaign_id || r.campaignId || r.data?.campaign_id || r.data?.campaignId;
        return rowCampId !== campaignId;
      });
      for (const t of tokens) {
        list.push({
          id: t.id,
          campaign_id: campaignId,
          data: t,
          updated_at: new Date().toISOString()
        });
      }
      safeLocalStorageSetItem('supabase_table_tokens', JSON.stringify(list));
    } catch (mirrorErr) {}
  } catch (e) {
    console.warn("Warning saving local tokens:", e);
  }
};

const notifyTokenListeners = (campaignId: string, tokens: TableToken[]) => {
  const listeners = tokenListeners.get(campaignId);
  if (listeners) {
    listeners.forEach(cb => {
      try { cb(tokens); } catch (e) { console.error(e); }
    });
  }
};

export const getLocalConfig = (campaignId: string): TableConfig => {
  let result: TableConfig = { gridSize: 50, showGrid: true, masterFog: false, mapUrl: '' };
  try {
    const stored = safeLocalStorageGetItem(`vtt_config_${campaignId}`) || localStorage.getItem(`vtt_config_${campaignId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      result = { ...result, ...parsed };
    }
  } catch (e) {
    console.warn("Warning reading local config:", e);
  }

  // If mapUrl is missing or empty, attempt robust multi-source recovery
  if (!result.mapUrl || result.mapUrl.trim() === '') {
    try {
      // 1. Check supabase_table_campaign_configs
      const tableData = safeLocalStorageGetItem('supabase_table_campaign_configs') || localStorage.getItem('supabase_table_campaign_configs');
      if (tableData) {
        const list = JSON.parse(tableData);
        const mapRow = list.find((r: any) => 
          (r.campaign_id === campaignId || r.campaignId === campaignId || r.id === `${campaignId}_map` || r.id === campaignId) && 
          (r.config_id === 'map' || r.configId === 'map' || r.mapUrl || r.map_url || (r.data && (r.data.mapUrl || r.data.map_url)))
        );
        if (mapRow) {
          let mapData = mapRow.data || mapRow;
          if (typeof mapData === 'string') {
            try { mapData = JSON.parse(mapData); } catch (e) {}
          }
          const foundUrl = (mapData && (mapData.mapUrl || mapData.map_url)) || mapRow.mapUrl || mapRow.map_url || '';
          if (foundUrl) {
            result.mapUrl = foundUrl;
          }
        }
      }
    } catch (recErr) {}

    // 2. Check campaigns table (campaign.mapUrl / campaign.data.mapUrl)
    if (!result.mapUrl || result.mapUrl.trim() === '') {
      try {
        const campsData = safeLocalStorageGetItem('supabase_table_campaigns') || localStorage.getItem('supabase_table_campaigns');
        if (campsData) {
          const list = JSON.parse(campsData);
          const camp = list.find((c: any) => c.id === campaignId);
          if (camp) {
            let cData = camp.data || camp;
            if (typeof cData === 'string') {
              try { cData = JSON.parse(cData); } catch (e) {}
            }
            const foundUrl = (cData && (cData.mapUrl || cData.map_url)) || camp.mapUrl || camp.map_url || '';
            if (foundUrl) {
              result.mapUrl = foundUrl;
            }
          }
        }
      } catch (recErr2) {}
    }
  }

  return result;
};

export const saveLocalConfig = (campaignId: string, config: TableConfig) => {
  try {
    safeLocalStorageSetItem(`vtt_config_${campaignId}`, JSON.stringify(config));
    
    // Also mirror to supabase_table_campaign_configs
    try {
      const nowStr = new Date().toISOString();
      const tableData = safeLocalStorageGetItem('supabase_table_campaign_configs') || localStorage.getItem('supabase_table_campaign_configs');
      let list = tableData ? JSON.parse(tableData) : [];
      list = list.filter((r: any) => {
        const rowCampId = r.campaign_id || r.campaignId;
        return rowCampId !== campaignId && r.id !== `${campaignId}_main` && r.id !== `${campaignId}_map`;
      });
      list.push({
        id: `${campaignId}_main`,
        campaign_id: campaignId,
        config_id: 'main',
        data: config,
        updated_at: nowStr
      });
      if (config.mapUrl) {
        list.push({
          id: `${campaignId}_map`,
          campaign_id: campaignId,
          config_id: 'map',
          data: { mapUrl: config.mapUrl, updatedAt: nowStr },
          mapUrl: config.mapUrl,
          updated_at: nowStr
        });
      }
      safeLocalStorageSetItem('supabase_table_campaign_configs', JSON.stringify(list));
    } catch (mErr) {}
  } catch (e) {
    console.warn("Warning saving local config:", e);
  }
};

const notifyConfigListeners = (campaignId: string, config: TableConfig) => {
  const listeners = configListeners.get(campaignId);
  if (listeners) {
    listeners.forEach(cb => {
      try { cb(config); } catch (e) { console.error(e); }
    });
  }
};

export const getLocalLogs = (campaignId: string): any[] => {
  try {
    const stored = safeLocalStorageGetItem(`vtt_logs_${campaignId}`) || localStorage.getItem(`vtt_logs_${campaignId}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn("Warning reading local logs:", e);
  }
  return [];
};

export const saveLocalLogs = (campaignId: string, logs: any[]) => {
  try {
    const trimmedLogs = Array.isArray(logs) && logs.length > 50 ? logs.slice(-50) : logs;
    safeLocalStorageSetItem(`vtt_logs_${campaignId}`, JSON.stringify(trimmedLogs));
  } catch (e) {
    console.warn("Warning saving local logs:", e);
  }
};

const notifyLogListeners = (campaignId: string, logs: any[]) => {
  const listeners = logListeners.get(campaignId);
  if (listeners) {
    listeners.forEach(cb => {
      try { cb(logs); } catch (e) { console.error(e); }
    });
  }
};

// Subscriptions using Supabase Realtime with bulletproof local fallback preservation
export const subscribeToTokens = (campaignId: string, onUpdate: (tokens: TableToken[]) => void) => {
  if (!tokenListeners.has(campaignId)) {
    tokenListeners.set(campaignId, new Set());
  }
  tokenListeners.get(campaignId)!.add(onUpdate);

  // Return local tokens immediately for sub-millisecond instant UI render
  const localTokens = getLocalTokens(campaignId);
  onUpdate(localTokens);

  let active = true;
  let isFetching = false;
  let lastSerialized = '';

  const fetchAndNotify = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      // 1. Fetch from server VTT API (/api/campaigns/:id/vtt)
      let remoteTokens: TableToken[] = [];
      try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.tokens)) {
            remoteTokens = data.tokens;
          }
        }
      } catch (e) {}

      // Combine server tokens with local tokens
      const local = getLocalTokens(campaignId);
      const tokenMap = new Map<string, TableToken>();
      remoteTokens.forEach(t => { if (t && t.id) tokenMap.set(t.id, t); });
      local.forEach(t => { if (t && t.id && !tokenMap.has(t.id)) tokenMap.set(t.id, t); });

      const finalTokens = Array.from(tokenMap.values());
      saveLocalTokens(campaignId, finalTokens);

      const serialized = JSON.stringify(finalTokens);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        notifyTokenListeners(campaignId, finalTokens);
      }
    } catch (err) {
    } finally {
      isFetching = false;
    }
  };

  fetchAndNotify();

  // Polling loop at 600ms for sub-second real-time token movements across devices
  const pollInterval = setInterval(fetchAndNotify, 600);

  // Also setup Supabase snapshot / realtime as dual channel
  const q = query(
    collection(db, 'tokens'),
    where('campaign_id', '==', campaignId)
  );

  const unsubscribe = onSnapshot(q, () => {
    fetchAndNotify();
  });

  return () => {
    active = false;
    clearInterval(pollInterval);
    unsubscribe();
    const listeners = tokenListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) tokenListeners.delete(campaignId);
    }
  };
};

export const subscribeToTableConfig = (campaignId: string, onUpdate: (config: TableConfig) => void) => {
  if (!configListeners.has(campaignId)) {
    configListeners.set(campaignId, new Set());
  }
  configListeners.get(campaignId)!.add(onUpdate);

  const localConfig = getLocalConfig(campaignId);
  onUpdate(localConfig);

  let active = true;
  let isFetching = false;
  let lastSerialized = '';

  const fetchAndNotify = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      let remoteConfig: Partial<TableConfig> | null = null;
      try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.config) {
            remoteConfig = data.config;
          }
        }
      } catch (e) {}

      const local = getLocalConfig(campaignId);
      const mergedConfig = { ...local, ...(remoteConfig || {}) } as TableConfig;

      if (remoteConfig) {
        if (remoteConfig.mapUrl && remoteConfig.mapUrl.trim() !== '') {
          mergedConfig.mapUrl = remoteConfig.mapUrl;
        } else if (!remoteConfig.mapUrl && local.mapUrl && remoteConfig.mapUrl !== "") {
          mergedConfig.mapUrl = local.mapUrl;
        }
      }

      saveLocalConfig(campaignId, mergedConfig);

      const serialized = JSON.stringify(mergedConfig);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        notifyConfigListeners(campaignId, mergedConfig);
      }
    } catch (err) {
    } finally {
      isFetching = false;
    }
  };

  fetchAndNotify();

  const pollInterval = setInterval(fetchAndNotify, 600);

  const q = query(
    collection(db, 'campaign_configs'),
    where('campaign_id', '==', campaignId)
  );

  const unsubscribe = onSnapshot(q, () => {
    fetchAndNotify();
  });

  return () => {
    active = false;
    clearInterval(pollInterval);
    unsubscribe();
    const listeners = configListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) configListeners.delete(campaignId);
    }
  };
};

export const subscribeToCombatLogs = (campaignId: string, onUpdate: (logs: any[]) => void) => {
  if (!logListeners.has(campaignId)) {
    logListeners.set(campaignId, new Set());
  }
  logListeners.get(campaignId)!.add(onUpdate);

  // Load from local storage immediately
  const localLogs = getLocalLogs(campaignId);
  onUpdate(localLogs);

  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [VTT] Firestore quota exceeded. Skipping snapshot listener for combat logs.");
    return () => {
      const listeners = logListeners.get(campaignId);
      if (listeners) {
        listeners.delete(onUpdate);
        if (listeners.size === 0) {
          logListeners.delete(campaignId);
        }
      }
    };
  }

  let active = true;

  const q = query(
    collection(db, 'vtt_logs'),
    where('campaign_id', '==', campaignId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active) return;
    try {
      const logs: any[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData) {
          const timestampSecs = docData.created_at ? Math.floor(new Date(docData.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
          logs.push({
            id: doc.id,
            timestamp: { seconds: timestampSecs, nanoseconds: 0 },
            created_at: docData.created_at,
            ...docData.data
          });
        }
      });

      // Sort in memory by created_at descending (or timestamp descending)
      logs.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      const slicedLogs = logs.slice(0, 25);
      saveLocalLogs(campaignId, slicedLogs);
      notifyLogListeners(campaignId, slicedLogs);
    } catch (e) {
      console.error("[subscribeToCombatLogs onSnapshot] Error:", e);
    }
  }, (error) => {
    console.error("[subscribeToCombatLogs onSnapshot] Listener error:", error);
    try {
      handleFirestoreError(error, 'get', 'vtt_logs');
    } catch (err) {
      // Ignora erro relançado para não quebrar a aplicação
    }
  });

  return () => {
    const listeners = logListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        logListeners.delete(campaignId);
      }
    }
    active = false;
    unsubscribe();
  };
};

// Writes with local-first instant dispatch and dynamic Supabase sync
export const updateTokenPosition = async (
  campaignId: string, 
  tokenId: string, 
  updates: Partial<TableToken>,
  tokensFallback?: TableToken[]
) => {
  // Always apply change locally first and dispatch UI updates instantly!
  let currentTokens = getLocalTokens(campaignId);
  
  if (tokensFallback && tokensFallback.length > 0) {
    const existingIds = new Set(currentTokens.map(t => t.id));
    for (const t of tokensFallback) {
      if (!existingIds.has(t.id)) {
        currentTokens.push(t);
        existingIds.add(t.id);
      }
    }
  }

  // If token is still missing from currentTokens, create or recover from fallback
  if (!currentTokens.some(t => t.id === tokenId)) {
    const fromFallback = tokensFallback?.find(t => t.id === tokenId);
    if (fromFallback) {
      currentTokens.push(fromFallback);
    }
  }

  const updatedTokens = currentTokens.map(t => t.id === tokenId ? { ...t, ...updates } : t);
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  const matchedToken = updatedTokens.find(t => t.id === tokenId);
  if (!matchedToken) return;

  // Post to backend server VTT API for instant sub-second sync across devices
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: matchedToken })
    }).catch(() => {});
  } catch (e) {}

  try {
    const { error } = await supabase
      .from('tokens')
      .upsert({
        id: tokenId,
        campaign_id: campaignId,
        data: matchedToken,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase updateTokenPosition] Error:", error);
    }
  } catch (error) {
    console.error("[Supabase updateTokenPosition] Exception:", error);
  }
};

export const updateMultipleTokens = async (
  campaignId: string,
  tokenUpdates: { id: string; updates: Partial<TableToken> }[],
  tokensFallback?: TableToken[]
) => {
  if (!tokenUpdates || tokenUpdates.length === 0) return;

  const baseMap = new Map<string, TableToken>();
  
  // 1. If caller provided current tokens from state, use it as primary ground truth
  if (tokensFallback && tokensFallback.length > 0) {
    for (const t of tokensFallback) {
      baseMap.set(t.id, t);
    }
  }
  
  // 2. Also incorporate any local tokens that might not be in fallback
  const localTokens = getLocalTokens(campaignId);
  for (const t of localTokens) {
    if (!baseMap.has(t.id)) {
      baseMap.set(t.id, t);
    }
  }

  // 3. Apply updates to the tokens
  const updateMap = new Map(tokenUpdates.map(u => [u.id, u.updates]));
  for (const [id, updates] of updateMap.entries()) {
    const existing = baseMap.get(id);
    if (existing) {
      baseMap.set(id, { ...existing, ...updates });
    }
  }

  const updatedTokens = Array.from(baseMap.values());
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: updatedTokens })
    }).catch(() => {});
  } catch (e) {}

  try {
    for (const { id } of tokenUpdates) {
      const matchedToken = baseMap.get(id);
      if (matchedToken) {
        await supabase
          .from('tokens')
          .upsert({
            id: id,
            campaign_id: campaignId,
            data: matchedToken,
            updated_at: new Date().toISOString()
          });
      }
    }
  } catch (error) {
    console.error("[Supabase updateMultipleTokens] Error:", error);
  }
};

export const addToken = async (campaignId: string, token: TableToken) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = [...currentTokens.filter(t => t.id !== token.id), token];
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    }).catch(() => {});
  } catch (e) {}

  try {
    const { error } = await supabase
      .from('tokens')
      .upsert({
        id: token.id,
        campaign_id: campaignId,
        data: token,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase addToken] Error:", error);
    }
  } catch (error) {
    console.error("[Supabase addToken] Exception:", error);
  }
};

export const removeToken = async (campaignId: string, tokenId: string) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = currentTokens.filter(t => t.id !== tokenId);
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens/${encodeURIComponent(tokenId)}`, {
      method: "DELETE"
    }).catch(() => {});
  } catch (e) {}

  try {
    const { error } = await supabase
      .from('tokens')
      .delete()
      .eq('id', tokenId);

    if (error) {
      console.error("[Supabase removeToken] Error:", error);
    }
  } catch (error) {
    console.error("[Supabase removeToken] Exception:", error);
  }
};

export const updateTableConfig = async (campaignId: string, config: Partial<TableConfig>) => {
  if (!campaignId) return;

  const nowStr = new Date().toISOString();
  // Always apply change locally first and dispatch UI updates instantly!
  const currentConfig = getLocalConfig(campaignId);
  const updatedConfig = { ...currentConfig, ...config, updatedAt: nowStr } as TableConfig;
  saveLocalConfig(campaignId, updatedConfig);
  notifyConfigListeners(campaignId, updatedConfig);
  
  // Persist directly to server VTT store
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: updatedConfig })
    }).catch(() => {});
  } catch (e) {}

  // Background sync to Supabase without blocking the client UI thread
  const { mapUrl, ...rest } = config;
  try {
    if (Object.keys(rest).length > 0) {
      const fullLocal = getLocalConfig(campaignId);
      const { mapUrl: _, ...localMain } = fullLocal;
      const mergedMain = { ...localMain, ...rest, updatedAt: nowStr };

      supabase
        .from('campaign_configs')
        .upsert({
          id: `${campaignId}_main`,
          campaign_id: campaignId,
          config_id: 'main',
          data: mergedMain,
          updated_at: nowStr
        })
        .then(({ error }) => {
          if (error) console.error("[Supabase updateTableConfig main] Error:", error);
        })
        .catch(err => {
          console.error("[Supabase updateTableConfig] Exception:", err);
        });
    }
    
    if (mapUrl !== undefined) {
      supabase
        .from('campaign_configs')
        .upsert({
          id: `${campaignId}_map`,
          campaign_id: campaignId,
          config_id: 'map',
          data: { mapUrl, updatedAt: nowStr },
          mapUrl: mapUrl,
          updated_at: nowStr
        })
        .then(({ error }) => {
          if (error) console.error("[Supabase updateTableConfig map] Error:", error);
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error("[Supabase updateTableConfig] Exception:", error);
  }

  return updatedConfig;
};

export const addCombatLog = async (campaignId: string, log: any) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const logWithId = { 
    id: generateLocalId(), 
    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }, 
    ...log 
  };
  const currentLogs = getLocalLogs(campaignId);
  const updatedLogs = [logWithId, ...currentLogs].slice(0, 50); // Mantenha os últimos 50
  saveLocalLogs(campaignId, updatedLogs);
  notifyLogListeners(campaignId, updatedLogs);

  try {
    const { error } = await supabase
      .from('vtt_logs')
      .insert({
        id: logWithId.id,
        campaign_id: campaignId,
        data: log,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase addCombatLog] Error:", error);
    }
  } catch (error) {
    console.error("[Supabase addCombatLog] Exception:", error);
  }
};
