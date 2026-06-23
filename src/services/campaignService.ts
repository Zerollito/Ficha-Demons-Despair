import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, isFirebaseQuotaExceeded } from '../lib/firebase';
import { Campaign, Character } from '../types';
import { generateInviteCode } from '../lib/random';

const CAMPAIGNS_COLLECTION = 'campaigns';
const CHARACTERS_COLLECTION = 'characters';

export const createCampaign = async (name: string) => {
  if (!auth.currentUser) return null;
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Não é possível criar campanhas: Limite de cota diário excedido.");
    return null;
  }

  const inviteCode = generateInviteCode();
  const campaignData = {
    name,
    masterId: auth.currentUser.uid,
    masterEmail: auth.currentUser.email,
    inviteCode,
    createdAt: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), campaignData);
    return { id: docRef.id, ...campaignData };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CAMPAIGNS_COLLECTION);
    return null;
  }
};

export const subscribeToMasterCampaigns = (onUpdate: (campaigns: Campaign[]) => void) => {
  if (!auth.currentUser) return () => {};

  // Em cenários de mudança de UID, permitimos busca por ID ou Email
  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where('masterEmail', '==', auth.currentUser.email)
  );

  return onSnapshot(q, (snapshot) => {
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    onUpdate(campaigns);
  }, (error) => {
    const isQuota = String(error?.message || error).toLowerCase().includes('quota') || 
                    String(error?.message || error).toLowerCase().includes('resource-exhausted');
    if (isQuota) {
      handleFirestoreError(error, OperationType.LIST, CAMPAIGNS_COLLECTION);
      return;
    }
    // Fallback para masterId se masterEmail falhar ou não retornar nada (campanhas antigas)
    if (auth.currentUser) {
      const qFallback = query(
        collection(db, CAMPAIGNS_COLLECTION),
        where('masterId', '==', auth.currentUser.uid)
      );
      return onSnapshot(qFallback, (snapshot) => {
        const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        onUpdate(campaigns);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, CAMPAIGNS_COLLECTION);
      });
    }
  });
};

export const joinCampaign = async (characterId: string, inviteCode: string) => {
  if (isFirebaseQuotaExceeded()) {
    throw new Error('Não é possível entrar na campanha: O limite diário de gravação do banco de dados foi atingido.');
  }

  // Find campaign with invite code
  const q = query(collection(db, CAMPAIGNS_COLLECTION), where('inviteCode', '==', inviteCode));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Código de convite inválido.');
  }

  const campaignId = snapshot.docs[0].id;

  try {
    const charRef = doc(db, CHARACTERS_COLLECTION, characterId);
    await updateDoc(charRef, { 
      campaignId, 
      userEmail: auth.currentUser?.email || null,
      updatedAt: serverTimestamp() 
    });
    return campaignId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CHARACTERS_COLLECTION}/${characterId}`);
  }
};

export const deleteCampaign = async (campaignId: string) => {
  if (!auth.currentUser) return;
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Não é possível excluir a campanha: Limite de cota diário excedido.");
    return;
  }

  try {
    await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CAMPAIGNS_COLLECTION}/${campaignId}`);
  }
};

export const subscribeToCampaignsByIds = (campaignIds: string[], onUpdate: (campaigns: Campaign[]) => void) => {
  if (campaignIds.length === 0) {
    onUpdate([]);
    return () => {};
  }

  // Firestore "in" query limited to 10 elements. 
  // If more than 10, we'd need to chunk it, but usually a player isn't in 10+ campaigns at once.
  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where('__name__', 'in', campaignIds.slice(0, 10))
  );

  return onSnapshot(q, (snapshot) => {
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    onUpdate(campaigns);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CAMPAIGNS_COLLECTION);
  });
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

  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    where('campaignId', '==', campaignId)
  );

  const unsubFirestore = onSnapshot(q, (snapshot) => {
    const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character));
    saveLocalCampaignCharacters(campaignId, characters);
    notifyCampaignCharListeners(campaignId, characters);
  }, (error) => {
    console.warn("[campaignService] Error in subscribeToCampaignCharacters (handled):", error);
    handleFirestoreError(error, OperationType.LIST, CHARACTERS_COLLECTION);
  });

  return () => {
    const listeners = campaignCharListeners.get(campaignId);
    if (listeners) {
      listeners.delete(onUpdate);
      if (listeners.size === 0) {
        campaignCharListeners.delete(campaignId);
      }
    }
    unsubFirestore();
  };
};
