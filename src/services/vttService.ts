import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { TableToken, TableConfig } from '../types';

export const subscribeToTokens = (campaignId: string, onUpdate: (tokens: TableToken[]) => void) => {
  const tokensRef = collection(db, 'campaigns', campaignId, 'tokens');
  return onSnapshot(tokensRef, (snapshot) => {
    const tokens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TableToken));
    onUpdate(tokens);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `campaigns/${campaignId}/tokens`);
  });
};

export const subscribeToTableConfig = (campaignId: string, onUpdate: (config: TableConfig) => void) => {
  const mainRef = doc(db, 'campaigns', campaignId, 'config', 'main');
  const mapRef = doc(db, 'campaigns', campaignId, 'config', 'map');

  let mainData: Partial<TableConfig> = { gridSize: 50, showGrid: true, masterFog: false };
  let mapData: Partial<TableConfig> = { mapUrl: '' };

  const mergeAndNotify = () => {
    const combined = { ...mainData, ...mapData } as TableConfig;
    console.log("vttService: Notifying combined config:", combined);
    onUpdate(combined);
  };

  const unsubMain = onSnapshot(mainRef, (snapshot) => {
    console.log("vttService: Main config snapshot:", snapshot.exists() ? "exists" : "missing", snapshot.data());
    if (snapshot.exists()) {
      mainData = { ...mainData, ...snapshot.data() };
    }
    mergeAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `campaigns/${campaignId}/config/main`);
  });

  const unsubMap = onSnapshot(mapRef, (snapshot) => {
    if (snapshot.exists()) {
      mapData = { ...mapData, ...snapshot.data() };
    }
    mergeAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `campaigns/${campaignId}/config/map`);
  });

  return () => {
    unsubMain();
    unsubMap();
  };
};

export const updateTokenPosition = async (campaignId: string, tokenId: string, updates: Partial<TableToken>) => {
  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', tokenId);
  try {
    // Clean undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(tokenRef, cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}/tokens/${tokenId}`);
  }
};

export const addToken = async (campaignId: string, token: TableToken) => {
  console.log("vttService: Adding token to Firestore:", { campaignId, tokenId: token.id, token });
  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', token.id);
  try {
    // Clean undefined values
    const cleanToken = Object.fromEntries(
      Object.entries(token).filter(([_, v]) => v !== undefined)
    );
    await setDoc(tokenRef, cleanToken);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `campaigns/${campaignId}/tokens/${token.id}`);
  }
};

export const removeToken = async (campaignId: string, tokenId: string) => {
  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', tokenId);
  try {
    await deleteDoc(tokenRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `campaigns/${campaignId}/tokens/${tokenId}`);
  }
};

export const updateTableConfig = async (campaignId: string, config: Partial<TableConfig>) => {
  if (!campaignId) {
    console.warn("updateTableConfig: No campaignId provided");
    return;
  }
  
  console.log("vttService: Updating table config for campaign", campaignId, config);
  
  const { mapUrl, ...rest } = config;
  
  try {
    if (Object.keys(rest).length > 0) {
      const mainRef = doc(db, 'campaigns', campaignId, 'config', 'main');
      
      // Flatten nested objects for more reliable merging if needed, 
      // but for now we just make sure we're sending defined values.
      const cleanRest = Object.fromEntries(
        Object.entries(rest).filter(([_, v]) => v !== undefined)
      );
      
      if (Object.keys(cleanRest).length > 0) {
        await setDoc(mainRef, cleanRest, { merge: true });
      }
    }
    
    if (mapUrl !== undefined) {
      const mapRef = doc(db, 'campaigns', campaignId, 'config', 'map');
      await setDoc(mapRef, { mapUrl }, { merge: true });
    }
  } catch (error) {
    console.error("Firestore Update Error in updateTableConfig:", error);
    handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaignId}/config`);
  }
};

export const addCombatLog = async (campaignId: string, log: any) => {
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

export const subscribeToCombatLogs = (campaignId: string, onUpdate: (logs: any[]) => void) => {
  const logsRef = collection(db, 'campaigns', campaignId, 'vtt_logs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
  
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    onUpdate(logs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `campaigns/${campaignId}/vtt_logs`);
  });
};
