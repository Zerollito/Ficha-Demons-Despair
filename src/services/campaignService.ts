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
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Campaign, Character } from '../types';

const CAMPAIGNS_COLLECTION = 'campaigns';
const CHARACTERS_COLLECTION = 'characters';

export const createCampaign = async (name: string) => {
  if (!auth.currentUser) return null;

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const campaignData = {
    name,
    masterId: auth.currentUser.uid,
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

  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where('masterId', '==', auth.currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    onUpdate(campaigns);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CAMPAIGNS_COLLECTION);
  });
};

export const joinCampaign = async (characterId: string, inviteCode: string) => {
  // Find campaign with invite code
  const q = query(collection(db, CAMPAIGNS_COLLECTION), where('inviteCode', '==', inviteCode));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Código de convite inválido.');
  }

  const campaignId = snapshot.docs[0].id;

  try {
    const charRef = doc(db, CHARACTERS_COLLECTION, characterId);
    await updateDoc(charRef, { campaignId, updatedAt: serverTimestamp() });
    return campaignId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CHARACTERS_COLLECTION}/${characterId}`);
  }
};

export const deleteCampaign = async (campaignId: string) => {
  if (!auth.currentUser) return;

  try {
    await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CAMPAIGNS_COLLECTION}/${campaignId}`);
  }
};

export const subscribeToCampaignCharacters = (campaignId: string, onUpdate: (characters: Character[]) => void) => {
  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    where('campaignId', '==', campaignId)
  );

  return onSnapshot(q, (snapshot) => {
    const characters = snapshot.docs.map(doc => ({ ...doc.data() } as Character));
    onUpdate(characters);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CHARACTERS_COLLECTION);
  });
};
