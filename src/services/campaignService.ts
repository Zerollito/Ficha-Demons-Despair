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
import { generateInviteCode } from '../lib/random';

const CAMPAIGNS_COLLECTION = 'campaigns';
const CHARACTERS_COLLECTION = 'characters';

export const createCampaign = async (name: string) => {
  if (!auth.currentUser) return null;

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

export const subscribeToCampaignCharacters = (campaignId: string, onUpdate: (characters: Character[]) => void) => {
  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    where('campaignId', '==', campaignId)
  );

  return onSnapshot(q, (snapshot) => {
    const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character));
    onUpdate(characters);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CHARACTERS_COLLECTION);
  });
};
