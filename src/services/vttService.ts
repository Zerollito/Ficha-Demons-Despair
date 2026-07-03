import { supabase, db, isFirebaseQuotaExceeded, handleFirestoreError, collection, query, where, onSnapshot } from '../lib/supabase';
import { TableToken, TableConfig } from '../types';

// Helper to generate IDs
const generateLocalId = () => Math.random().toString(36).substring(2, 11);

// Local Pub-Sub and Cache Stores
const tokenListeners = new Map<string, Set<(tokens: TableToken[]) => void>>();
const configListeners = new Map<string, Set<(config: TableConfig) => void>>();
const logListeners = new Map<string, Set<(logs: any[]) => void>>();

export const getLocalTokens = (campaignId: string): TableToken[] => {
  try {
    const stored = localStorage.getItem(`vtt_tokens_${campaignId}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Error reading local tokens:", e);
  }
  return [];
};

export const saveLocalTokens = (campaignId: string, tokens: TableToken[]) => {
  try {
    localStorage.setItem(`vtt_tokens_${campaignId}`, JSON.stringify(tokens));
  } catch (e) {
    console.error("Error saving local tokens:", e);
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
  try {
    const stored = localStorage.getItem(`vtt_config_${campaignId}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Error reading local config:", e);
  }
  return { gridSize: 50, showGrid: true, masterFog: false, mapUrl: '' } as TableConfig;
};

export const saveLocalConfig = (campaignId: string, config: TableConfig) => {
  try {
    localStorage.setItem(`vtt_config_${campaignId}`, JSON.stringify(config));
  } catch (e) {
    console.error("Error saving local config:", e);
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
    const stored = localStorage.getItem(`vtt_logs_${campaignId}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Error reading local logs:", e);
  }
  return [];
};

export const saveLocalLogs = (campaignId: string, logs: any[]) => {
  try {
    localStorage.setItem(`vtt_logs_${campaignId}`, JSON.stringify(logs));
  } catch (e) {
    console.error("Error saving local logs:", e);
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

// Subscriptions using Supabase Realtime
export const subscribeToTokens = (campaignId: string, onUpdate: (tokens: TableToken[]) => void) => {
  if (!tokenListeners.has(campaignId)) {
    tokenListeners.set(campaignId, new Set());
  }
  tokenListeners.get(campaignId)!.add(onUpdate);

  // Load from local storage immediately so VTT works with zero latency
  const localTokens = getLocalTokens(campaignId);
  onUpdate(localTokens);

  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [VTT] Firestore quota exceeded. Skipping snapshot listener for tokens.");
    return () => {
      const listeners = tokenListeners.get(campaignId);
      if (listeners) {
        listeners.delete(onUpdate);
        if (listeners.size === 0) {
          tokenListeners.delete(campaignId);
        }
      }
    };
  }

  let active = true;

  const q = query(
    collection(db, 'tokens'),
    where('campaign_id', '==', campaignId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active) return;
    try {
      const tokens: TableToken[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData && docData.data) {
          tokens.push(docData.data as TableToken);
        }
      });
      saveLocalTokens(campaignId, tokens);
      notifyTokenListeners(campaignId, tokens);
    } catch (e) {
      console.error("[subscribeToTokens onSnapshot] Error:", e);
    }
  }, (error) => {
    console.error("[subscribeToTokens onSnapshot] Listener error:", error);
    try {
      handleFirestoreError(error, 'get', 'tokens');
    } catch (err) {
      // Ignora erro relançado para não quebrar a aplicação
    }
  });

  return () => {
    const listeners = tokenListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        tokenListeners.delete(campaignId);
      }
    }
    active = false;
    unsubscribe();
  };
};

export const subscribeToTableConfig = (campaignId: string, onUpdate: (config: TableConfig) => void) => {
  if (!configListeners.has(campaignId)) {
    configListeners.set(campaignId, new Set());
  }
  configListeners.get(campaignId)!.add(onUpdate);

  // Load from local storage immediately
  const localConfig = getLocalConfig(campaignId);
  onUpdate(localConfig);

  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [VTT] Firestore quota exceeded. Skipping snapshot listener for table config.");
    return () => {
      const listeners = configListeners.get(campaignId);
      if (listeners) {
        listeners.delete(onUpdate);
        if (listeners.size === 0) {
          configListeners.delete(campaignId);
        }
      }
    };
  }

  let active = true;
  let mainData: Partial<TableConfig> = { gridSize: 50, showGrid: true, masterFog: false };
  let mapData: Partial<TableConfig> = { mapUrl: '' };

  const mergeAndNotify = () => {
    const local = getLocalConfig(campaignId);
    
    // Compare updatedAt. If local is newer than mainData/mapData, we keep local's time/date/weather/etc.
    const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
    const mainTime = mainData.updatedAt ? new Date(mainData.updatedAt).getTime() : 0;
    const mapTime = mapData.updatedAt ? new Date(mapData.updatedAt).getTime() : 0;

    let merged: TableConfig;
    if (localTime > Math.max(mainTime, mapTime)) {
      // Local is newer! Merge server data but keep local values as they are most fresh.
      merged = { ...mainData, ...mapData, ...local } as TableConfig;
    } else {
      // Server is newer, use server values
      merged = { ...local, ...mainData, ...mapData } as TableConfig;
    }

    saveLocalConfig(campaignId, merged);
    notifyConfigListeners(campaignId, merged);
  };

  const q = query(
    collection(db, 'campaign_configs'),
    where('campaign_id', '==', campaignId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active) return;
    try {
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData) {
          if (docData.config_id === 'main') {
            mainData = docData.data || {};
          } else if (docData.config_id === 'map') {
            mapData = docData.data || {};
          }
        }
      });
      mergeAndNotify();
    } catch (e) {
      console.error("[subscribeToTableConfig onSnapshot] Error:", e);
    }
  }, (error) => {
    console.error("[subscribeToTableConfig onSnapshot] Listener error:", error);
    try {
      handleFirestoreError(error, 'get', 'campaign_configs');
    } catch (err) {
      // Ignora erro relançado para não quebrar a aplicação
    }
  });

  return () => {
    const listeners = configListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        configListeners.delete(campaignId);
      }
    }
    active = false;
    unsubscribe();
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
export const updateTokenPosition = async (campaignId: string, tokenId: string, updates: Partial<TableToken>) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = currentTokens.map(t => t.id === tokenId ? { ...t, ...updates } : t);
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  const matchedToken = updatedTokens.find(t => t.id === tokenId);
  if (!matchedToken) return;

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

export const addToken = async (campaignId: string, token: TableToken) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = [...currentTokens.filter(t => t.id !== token.id), token];
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

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
  
  const { mapUrl, ...rest } = config;
  try {
    if (Object.keys(rest).length > 0) {
      // Get exact stored local main config to merge
      const fullLocal = getLocalConfig(campaignId);
      const { mapUrl: _, ...localMain } = fullLocal;
      const mergedMain = { ...localMain, ...rest, updatedAt: nowStr };

      const { error } = await supabase
        .from('campaign_configs')
        .upsert({
          campaign_id: campaignId,
          config_id: 'main',
          data: mergedMain,
          updated_at: nowStr
        });

      if (error) console.error("[Supabase updateTableConfig main] Error:", error);
    }
    
    if (mapUrl !== undefined) {
      const { error } = await supabase
        .from('campaign_configs')
        .upsert({
          campaign_id: campaignId,
          config_id: 'map',
          data: { mapUrl, updatedAt: nowStr },
          updated_at: nowStr
        });

      if (error) console.error("[Supabase updateTableConfig map] Error:", error);
    }
  } catch (error) {
    console.error("[Supabase updateTableConfig] Exception:", error);
  }
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
