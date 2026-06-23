import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  or,
  serverTimestamp,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, isFirebaseQuotaExceeded } from '../lib/firebase';
import { Character } from '../types';

const CHARACTERS_COLLECTION = 'characters';

const deepClean = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClean);
  
  // Only recurse into plain objects to avoid breaking Firestore-specific types (Timestamp, FieldValue, etc.)
  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype) return obj;

  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, deepClean(v)])
  );
};

export const saveCharacterToFirestore = async (character: Character) => {
  // Always update campaign cache locally first so updates are propagated instantly in VTT/Campaign
  if (character.campaignId) {
    try {
      const { getLocalCampaignCharacters, saveLocalCampaignCharacters, notifyCampaignCharListeners } = await import('./campaignService');
      const locals = getLocalCampaignCharacters(character.campaignId);
      const updatedLocals = locals.map(c => c.id === character.id ? { ...c, ...character } : c);
      if (!locals.some(c => c.id === character.id)) {
        updatedLocals.push(character);
      }
      saveLocalCampaignCharacters(character.campaignId, updatedLocals);
      notifyCampaignCharListeners(character.campaignId, updatedLocals);
    } catch (e) {
      console.error("Error updating campaign character local cache:", e);
    }
  }

  if (!auth.currentUser) {
    console.warn("⚠️ [Firestore] Tentativa de salvar sem usuário logado.");
    return;
  }

  if (isFirebaseQuotaExceeded()) {
    console.warn(`⚠️ [Firestore] Ignorando salvamento de "${character.nome}" pois o limite de cota diário foi atingido.`);
    return;
  }

  // Se o personagem tem o mesmo e-mail do usuário atual, forçamos o vínculo com o UID atual.
  // Isso resolve casos de migração de sessão ou mudança de UID (ex: trocar de provedor de login).
  const isOwnEmail = character.userEmail === auth.currentUser.email;
  const targetUserId = isOwnEmail ? auth.currentUser.uid : (character.userId || auth.currentUser.uid);
  const targetUserEmail = character.userEmail || auth.currentUser.email || "";

  console.log(`💾 [Firestore] Salvando ficha: ${character.nome} (${character.id}) para UID: ${targetUserId} e Email: ${targetUserEmail}`);
  const charRef = doc(db, CHARACTERS_COLLECTION, character.id);
  
  const data = {
    ...character,
    userId: targetUserId,
    userEmail: targetUserEmail,
    updatedAt: serverTimestamp(),
  };

  try {
    const cleanData = deepClean(data);
    const dataSize = JSON.stringify(cleanData).length;
    console.log(`⏳ [Firestore] Pushing ${character.nome} (${dataSize} bytes) to server...`);
    
    // Usando uma promessa com timeout para detectar se o Firestore ficar "engatado"
    // Sem persistência, setDoc deve retornar apenas quando o servidor confirmar.
    const savePromise = setDoc(charRef, cleanData, { merge: true });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout ao salvar ${character.nome}: Servidor não respondeu em 20s.`)), 20000)
    );

    await Promise.race([savePromise, timeoutPromise]);
    console.log(`✅ [Firestore] Ficha ${character.nome} CONFIRMADA pelo servidor.`);
  } catch (error) {
    const isQuota = String(error?.message || error).toLowerCase().includes('quota') || 
                    String(error?.message || error).toLowerCase().includes('resource-exhausted');
    if (!isQuota) {
      console.error(`❌ [Firestore] Erro ao salvar ${character.nome}:`, error);
    }
    handleFirestoreError(error, OperationType.WRITE, `${CHARACTERS_COLLECTION}/${character.id}`);
  }
};

export const deleteCharacterFromFirestore = async (characterId: string) => {
  if (!auth.currentUser) return;
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Ignorando deleção pois o limite de cota diário foi atingido.");
    return;
  }

  const charRef = doc(db, CHARACTERS_COLLECTION, characterId);

  try {
    await deleteDoc(charRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CHARACTERS_COLLECTION}/${characterId}`);
  }
};

export const subscribeToUserCharacters = (onUpdate: (characters: Character[], metadata: { hasPendingWrites: boolean, fromCache: boolean }) => void) => {
  if (!auth.currentUser) return () => {};

  // Busca tanto por UID quanto por Email para garantir sincronização entre dispositivos
  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    or(
      where("userId", "==", auth.currentUser.uid),
      where("userEmail", "==", auth.currentUser.email)
    )
  );

  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character));
    console.log(`📡 [Sync] Snapshot: ${snapshot.docs.length} docs, fromCache: ${snapshot.metadata.fromCache}, pendingWrites: ${snapshot.metadata.hasPendingWrites}`);
    onUpdate(characters, { 
      hasPendingWrites: snapshot.metadata.hasPendingWrites, 
      fromCache: snapshot.metadata.fromCache 
    });
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CHARACTERS_COLLECTION);
  });
};
