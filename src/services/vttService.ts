import { 
  collection, 
  doc, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseQuotaExceeded } from '../lib/firebase';
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

// Subscriptions
export const subscribeToTokens = (campaignId: string, onUpdate: (tokens: TableToken[]) => void) => {
  if (!tokenListeners.has(campaignId)) {
    tokenListeners.set(campaignId, new Set());
  }
  tokenListeners.get(campaignId)!.add(onUpdate);

  // Load from local storage immediately so VTT works without latency & under quota limits
  const localTokens = getLocalTokens(campaignId);
  onUpdate(localTokens);

  const tokensRef = collection(db, 'campaigns', campaignId, 'tokens');
  const unsubFirestore = onSnapshot(tokensRef, (snapshot) => {
    const tokens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TableToken));
    saveLocalTokens(campaignId, tokens);
    notifyTokenListeners(campaignId, tokens);
  }, (error) => {
    console.warn(`[vttService] Firestore subscribeToTokens error on campaign ${campaignId} (normal if offline/over quota):`, error);
    handleFirestoreError(error, OperationType.LIST, `campaigns/${campaignId}/tokens`);
  });

  return () => {
    const listeners = tokenListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        tokenListeners.delete(campaignId);
      }
    }
    unsubFirestore();
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

  const mainRef = doc(db, 'campaigns', campaignId, 'config', 'main');
  const mapRef = doc(db, 'campaigns', campaignId, 'config', 'map');

  let mainData: Partial<TableConfig> = { gridSize: 50, showGrid: true, masterFog: false };
  let mapData: Partial<TableConfig> = { mapUrl: '' };

  const mergeAndNotify = () => {
    const merged = { ...getLocalConfig(campaignId), ...mainData, ...mapData } as TableConfig;
    saveLocalConfig(campaignId, merged);
    notifyConfigListeners(campaignId, merged);
  };

  const unsubMain = onSnapshot(mainRef, (snapshot) => {
    if (snapshot.exists()) {
      mainData = { ...mainData, ...snapshot.data() };
    }
    mergeAndNotify();
  }, (error) => {
    console.warn(`[vttService] Firestore subscribeToTableConfig main error (handled):`, error);
    handleFirestoreError(error, OperationType.GET, `campaigns/${campaignId}/config/main`);
  });

  const unsubMap = onSnapshot(mapRef, (snapshot) => {
    if (snapshot.exists()) {
      mapData = { ...mapData, ...snapshot.data() };
    }
    mergeAndNotify();
  }, (error) => {
    console.warn(`[vttService] Firestore subscribeToTableConfig map error (handled):`, error);
    handleFirestoreError(error, OperationType.GET, `campaigns/${campaignId}/config/map`);
  });

  return () => {
    const listeners = configListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        configListeners.delete(campaignId);
      }
    }
    unsubMain();
    unsubMap();
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

  const logsRef = collection(db, 'campaigns', campaignId, 'vtt_logs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(25));
  
  const unsubFirestore = onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    saveLocalLogs(campaignId, logs);
    notifyLogListeners(campaignId, logs);
  }, (error) => {
    console.warn(`[vttService] Firestore subscribeToCombatLogs error (handled):`, error);
    handleFirestoreError(error, OperationType.LIST, `campaigns/${campaignId}/vtt_logs`);
  });

  return () => {
    const listeners = logListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        logListeners.delete(campaignId);
      }
    }
    unsubFirestore();
  };
};

// Writes with local-first instant dispatch and dynamic Firebase failover
export const updateTokenPosition = async (campaignId: string, tokenId: string, updates: Partial<TableToken>) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = currentTokens.map(t => t.id === tokenId ? { ...t, ...updates } : t);
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  if (isFirebaseQuotaExceeded()) {
    console.log(`📡 [VTT Mode Local] Token ${tokenId} atualizado offline.`);
    return;
  }

  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', tokenId);
  try {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await firestoreUpdateDoc(tokenRef, cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}/tokens/${tokenId}`);
  }
};

export const addToken = async (campaignId: string, token: TableToken) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = [...currentTokens.filter(t => t.id !== token.id), token];
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  if (isFirebaseQuotaExceeded()) {
    console.log(`📡 [VTT Mode Local] Token ${token.id} adicionado offline.`);
    return;
  }

  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', token.id);
  try {
    const cleanToken = Object.fromEntries(
      Object.entries(token).filter(([_, v]) => v !== undefined)
    );
    await firestoreSetDoc(tokenRef, cleanToken);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `campaigns/${campaignId}/tokens/${token.id}`);
  }
};

export const removeToken = async (campaignId: string, tokenId: string) => {
  // Always apply change locally first and dispatch UI updates instantly!
  const currentTokens = getLocalTokens(campaignId);
  const updatedTokens = currentTokens.filter(t => t.id !== tokenId);
  saveLocalTokens(campaignId, updatedTokens);
  notifyTokenListeners(campaignId, updatedTokens);

  if (isFirebaseQuotaExceeded()) {
    console.log(`📡 [VTT Mode Local] Token ${tokenId} removido offline.`);
    return;
  }

  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', tokenId);
  try {
    await deleteDoc(tokenRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `campaigns/${campaignId}/tokens/${tokenId}`);
  }
};

export const updateTableConfig = async (campaignId: string, config: Partial<TableConfig>) => {
  if (!campaignId) return;

  // Always apply change locally first and dispatch UI updates instantly!
  const currentConfig = getLocalConfig(campaignId);
  const updatedConfig = { ...currentConfig, ...config } as TableConfig;
  saveLocalConfig(campaignId, updatedConfig);
  notifyConfigListeners(campaignId, updatedConfig);

  if (isFirebaseQuotaExceeded()) {
    console.log(`📡 [VTT Mode Local] Configuração atualizada offline.`);
    return;
  }
  
  const { mapUrl, ...rest } = config;
  try {
    if (Object.keys(rest).length > 0) {
      const mainRef = doc(db, 'campaigns', campaignId, 'config', 'main');
      const cleanRest = Object.fromEntries(
        Object.entries(rest).filter(([_, v]) => v !== undefined)
      );
      if (Object.keys(cleanRest).length > 0) {
        await firestoreSetDoc(mainRef, cleanRest, { merge: true });
      }
    }
    
    if (mapUrl !== undefined) {
      const mapRef = doc(db, 'campaigns', campaignId, 'config', 'map');
      await firestoreSetDoc(mapRef, { mapUrl }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaignId}/config`);
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
  const updatedLogs = [logWithId, ...currentLogs].slice(0, 50); // Mantenha últimos 50
  saveLocalLogs(campaignId, updatedLogs);
  notifyLogListeners(campaignId, updatedLogs);

  if (isFirebaseQuotaExceeded()) {
    console.log(`📡 [VTT Mode Local] Novo registro de combate adicionado offline.`);
    return;
  }

  const logRef = collection(db, 'campaigns', campaignId, 'vtt_logs');
  try {
    await addDoc(logRef, {
      ...log,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `campaigns/${campaignId}/vtt_logs`);
  }
};
