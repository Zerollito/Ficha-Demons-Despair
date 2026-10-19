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
  let result: TableConfig = { gridSize: 50, showGrid: true, masterFog: false, mapUrl: '', gridColor: '#000000' };
  try {
    const stored = safeLocalStorageGetItem(`vtt_config_${campaignId}`) || localStorage.getItem(`vtt_config_${campaignId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      result = { ...result, ...parsed };
    }
  } catch (e) {
    console.warn("Warning reading local config:", e);
  }

  if (!result.gridColor) {
    result.gridColor = '#000000';
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
    const finalCfg = { gridColor: '#000000', ...config };
    safeLocalStorageSetItem(`vtt_config_${campaignId}`, JSON.stringify(finalCfg));
    
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
        data: finalCfg,
        updated_at: nowStr
      });
      if (finalCfg.mapUrl) {
        list.push({
          id: `${campaignId}_map`,
          campaign_id: campaignId,
          config_id: 'map',
          data: { mapUrl: finalCfg.mapUrl, updatedAt: nowStr },
          mapUrl: finalCfg.mapUrl,
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

// High-Performance Hybrid Real-Time Stream Manager (WebSocket First + Resilient SSE Fallback)
interface RealtimeCampaignState {
  ws: WebSocket | null;
  eventSource: EventSource | null;
  refCount: number;
  pollTimer: any;
  reconnectTimer: any;
}

const activeRealtimeStreams = new Map<string, RealtimeCampaignState>();

export const sendVttRealtimeMessage = (campaignId: string, payload: any) => {
  const entry = activeRealtimeStreams.get(campaignId);
  if (entry && entry.ws && entry.ws.readyState === WebSocket.OPEN) {
    try {
      entry.ws.send(JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn("[VTT WS send error]", e);
    }
  }
  return false;
};

function connectVttStream(campaignId: string) {
  if (typeof window === 'undefined') return;

  let entry = activeRealtimeStreams.get(campaignId);
  if (!entry) {
    entry = { ws: null, eventSource: null, refCount: 0, pollTimer: null, reconnectTimer: null };
    activeRealtimeStreams.set(campaignId, entry);
  }
  entry.refCount++;

  const handleIncomingPayload = (payload: any) => {
    if (!payload || typeof payload !== 'object') return;
    
    // Live Drag Movement from another player: update smoothly in real time (<1ms)
    if (payload.type === 'token_live_move' && payload.tokenId) {
      const current = getLocalTokens(campaignId);
      const updated = current.map(t => t.id === payload.tokenId ? { ...t, x: payload.x, y: payload.y } : t);
      saveLocalTokens(campaignId, updated);
      notifyTokenListeners(campaignId, updated);
      return;
    }

    if (payload.tokens && Array.isArray(payload.tokens)) {
      saveLocalTokens(campaignId, payload.tokens);
      notifyTokenListeners(campaignId, payload.tokens);
    }
    if (payload.config && typeof payload.config === 'object') {
      const finalCfg = { gridColor: '#000000', ...payload.config };
      saveLocalConfig(campaignId, finalCfg);
      notifyConfigListeners(campaignId, finalCfg);
    }
  };

  const startWebSocket = () => {
    if (typeof window === 'undefined' || !window.WebSocket) {
      startSSE();
      return;
    }

    // Guard: Prevent re-opening socket if already connected or connecting
    if (entry?.ws && (entry.ws.readyState === WebSocket.OPEN || entry.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/vtt/ws?campaignId=${encodeURIComponent(campaignId)}`;
      const ws = new WebSocket(wsUrl);
      entry!.ws = ws;
      const currentWs = ws;

      ws.onopen = () => {
        console.log(`⚡ [VTT WS] Conectado com sucesso à mesa (${campaignId})`);
        // If SSE was running as fallback, close it to avoid duplicate network traffic
        if (entry?.eventSource) {
          entry.eventSource.close();
          entry.eventSource = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          if (!event.data) return;
          const payload = JSON.parse(event.data);
          handleIncomingPayload(payload);
        } catch (err) {
          console.warn("[VTT WS] Message parse warning:", err);
        }
      };

      ws.onclose = () => {
        if (entry?.ws === currentWs) {
          entry.ws = null;
        }
        // Schedule auto-reconnect or fallback to SSE
        if (entry && entry.refCount > 0 && !entry.reconnectTimer) {
          startSSE();
          entry.reconnectTimer = setTimeout(() => {
            if (entry) {
              entry.reconnectTimer = null;
              if (entry.refCount > 0 && (!entry.ws || entry.ws.readyState === WebSocket.CLOSED)) {
                startWebSocket();
              }
            }
          }, 800);
        }
      };

      ws.onerror = () => {
        startSSE();
      };
    } catch {
      startSSE();
    }
  };

  const startSSE = () => {
    if (entry?.eventSource || entry?.ws?.readyState === WebSocket.OPEN || entry?.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      const url = `/api/campaigns/${encodeURIComponent(campaignId)}/vtt/stream`;
      const es = new EventSource(url);
      entry!.eventSource = es;

      es.onmessage = (event) => {
        try {
          if (!event.data) return;
          const payload = JSON.parse(event.data);
          handleIncomingPayload(payload);
        } catch (err) {
          console.warn("[VTT SSE] Message parse warning:", err);
        }
      };

      es.onerror = () => {
        // Browser EventSource automatically reconnects
      };
    } catch (err) {
      console.warn("[VTT SSE] Could not start EventSource, relying on polling fallback:", err);
    }
  };

  // Start with WebSocket for immediate sub-10ms duplex reactivity
  startWebSocket();

  // Failsafe background polling (every 600ms for high-frequency real-time resilience)
  if (!entry.pollTimer) {
    entry.pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.tokens)) {
            const current = getLocalTokens(campaignId);
            if (JSON.stringify(current) !== JSON.stringify(data.tokens)) {
              saveLocalTokens(campaignId, data.tokens);
              notifyTokenListeners(campaignId, data.tokens);
            }
          }
          if (data && data.config) {
            const currentCfg = getLocalConfig(campaignId);
            const mergedCfg = { gridColor: '#000000', ...data.config };
            if (JSON.stringify(currentCfg) !== JSON.stringify(mergedCfg)) {
              saveLocalConfig(campaignId, mergedCfg);
              notifyConfigListeners(campaignId, mergedCfg);
            }
          }
        }
      } catch {}
    }, 600);
  }
}

function disconnectVttStream(campaignId: string) {
  const entry = activeRealtimeStreams.get(campaignId);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    if (entry.ws) {
      try { entry.ws.close(); } catch {}
      entry.ws = null;
    }
    if (entry.eventSource) {
      entry.eventSource.close();
      entry.eventSource = null;
    }
    if (entry.pollTimer) {
      clearInterval(entry.pollTimer);
      entry.pollTimer = null;
    }
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }
    activeRealtimeStreams.delete(campaignId);
  }
}

// Subscriptions using instant real-time SSE stream with bulletproof local fallback preservation
export const subscribeToTokens = (campaignId: string, onUpdate: (tokens: TableToken[]) => void) => {
  if (!tokenListeners.has(campaignId)) {
    tokenListeners.set(campaignId, new Set());
  }
  tokenListeners.get(campaignId)!.add(onUpdate);

  // Return local tokens immediately for sub-millisecond instant UI render
  const localTokens = getLocalTokens(campaignId);
  onUpdate(localTokens);

  connectVttStream(campaignId);

  // Initial fast fetch
  fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt`)
    .then(res => res.json())
    .then(data => {
      if (data && Array.isArray(data.tokens)) {
        saveLocalTokens(campaignId, data.tokens);
        notifyTokenListeners(campaignId, data.tokens);
      }
    })
    .catch(() => {});

  return () => {
    disconnectVttStream(campaignId);
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

  connectVttStream(campaignId);

  // Initial fast fetch
  fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt`)
    .then(res => res.json())
    .then(data => {
      if (data && data.config) {
        const merged = { gridColor: '#000000', ...data.config };
        saveLocalConfig(campaignId, merged);
        notifyConfigListeners(campaignId, merged);
      }
    })
    .catch(() => {});

  return () => {
    disconnectVttStream(campaignId);
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

// Ultra-fast live position broadcast during active token drag (sub-millisecond peer sync)
export const broadcastTokenLivePosition = (
  campaignId: string,
  tokenId: string,
  x: number,
  y: number
) => {
  if (!campaignId || !tokenId) return;

  // 1. Instant duplex WebSocket dispatch to all other players
  const sent = sendVttRealtimeMessage(campaignId, {
    type: 'token_live_move',
    tokenId,
    x,
    y
  });

  // 2. Fast HTTP fallback if WebSocket is temporarily buffering
  if (!sent) {
    try {
      fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/live-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, x, y })
      }).catch(() => {});
    } catch {}
  }
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

  // 1. Instant sub-5ms duplex WebSocket transmission to all peers
  sendVttRealtimeMessage(campaignId, { type: 'token_move', token: matchedToken, tokens: updatedTokens });

  // 2. Post to backend server VTT API as fast HTTP backup
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: matchedToken })
    }).catch(() => {});
  } catch (e) {}

  // 3. Background asynchronous write to Supabase (never block UI execution)
  try {
    supabase
      .from('tokens')
      .upsert({
        id: tokenId,
        campaign_id: campaignId,
        data: matchedToken,
        updated_at: new Date().toISOString()
      })
      .then(({ error }) => {
        if (error) console.error("[Supabase updateTokenPosition] Error:", error);
      })
      .catch((err) => {
        console.error("[Supabase updateTokenPosition] Exception:", err);
      });
  } catch (e) {}
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

  // 1. Instant WebSocket push
  sendVttRealtimeMessage(campaignId, { type: 'update_tokens', tokens: updatedTokens });

  // 2. HTTP push in background
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: updatedTokens })
    }).catch(() => {});
  } catch (e) {}

  // 3. Background parallel Supabase sync
  try {
    const upserts = tokenUpdates.map(({ id }) => {
      const matchedToken = baseMap.get(id);
      if (!matchedToken) return Promise.resolve();
      return supabase
        .from('tokens')
        .upsert({
          id: id,
          campaign_id: campaignId,
          data: matchedToken,
          updated_at: new Date().toISOString()
        });
    });
    Promise.allSettled(upserts).catch(() => {});
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

  // 1. Instant WebSocket broadcast to other players
  sendVttRealtimeMessage(campaignId, { type: 'token_add', token, tokens: updatedTokens });

  // 2. Server persistence backup
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    }).catch(() => {});
  } catch (e) {}

  // 3. Supabase background sync
  try {
    supabase
      .from('tokens')
      .upsert({
        id: token.id,
        campaign_id: campaignId,
        data: token,
        updated_at: new Date().toISOString()
      })
      .then(({ error }) => {
        if (error) console.error("[Supabase addToken] Error:", error);
      })
      .catch((err) => {
        console.error("[Supabase addToken] Exception:", err);
      });
  } catch (e) {}
};

export const removeToken = async (campaignId: string, tokenId: string) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = currentTokens.filter(t => t.id !== tokenId);
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  // 1. Instant WebSocket broadcast to other players
  sendVttRealtimeMessage(campaignId, { type: 'token_remove', tokenId, tokens: updatedTokens });

  // 2. Server delete
  try {
    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/vtt/tokens/${encodeURIComponent(tokenId)}`, {
      method: "DELETE"
    }).catch(() => {});
  } catch (e) {}

  // 3. Supabase background delete
  try {
    supabase
      .from('tokens')
      .delete()
      .eq('id', tokenId)
      .then(({ error }) => {
        if (error) console.error("[Supabase removeToken] Error:", error);
      })
      .catch((err) => {
        console.error("[Supabase removeToken] Exception:", err);
      });
  } catch (e) {}
};

export const updateTableConfig = async (campaignId: string, config: Partial<TableConfig>) => {
  if (!campaignId) return;

  const nowStr = new Date().toISOString();
  // Always apply change locally first and dispatch UI updates instantly!
  const currentConfig = getLocalConfig(campaignId);
  const updatedConfig = { ...currentConfig, ...config, updatedAt: nowStr } as TableConfig;
  saveLocalConfig(campaignId, updatedConfig);
  notifyConfigListeners(campaignId, updatedConfig);
  
  // 1. Instant WebSocket push
  sendVttRealtimeMessage(campaignId, { type: 'update_config', config: updatedConfig });

  // 2. Persist directly to server VTT store as backup
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
