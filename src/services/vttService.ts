import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
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
    onUpdate({ ...mainData, ...mapData } as TableConfig);
  };

  const unsubMain = onSnapshot(mainRef, (snapshot) => {
    if (snapshot.exists()) {
      mainData = snapshot.data() as Partial<TableConfig>;
    }
    mergeAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `campaigns/${campaignId}/config/main`);
  });

  const unsubMap = onSnapshot(mapRef, (snapshot) => {
    if (snapshot.exists()) {
      mapData = snapshot.data() as Partial<TableConfig>;
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

export const updateTokenPosition = async (campaignId: string, tokenId: string, x: number, y: number, prevX?: number, prevY?: number) => {
  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', tokenId);
  try {
    const updateData: any = { x, y };
    if (prevX !== undefined) updateData.prevX = prevX;
    if (prevY !== undefined) updateData.prevY = prevY;
    await updateDoc(tokenRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}/tokens/${tokenId}`);
  }
};

export const addToken = async (campaignId: string, token: TableToken) => {
  const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', token.id);
  try {
    await setDoc(tokenRef, token);
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
  const { mapUrl, ...rest } = config;
  
  try {
    if (Object.keys(rest).length > 0) {
      const mainRef = doc(db, 'campaigns', campaignId, 'config', 'main');
      await setDoc(mainRef, rest, { merge: true });
    }
    
    if (mapUrl !== undefined) {
      const mapRef = doc(db, 'campaigns', campaignId, 'config', 'map');
      await setDoc(mapRef, { mapUrl }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaignId}/config`);
  }
};
