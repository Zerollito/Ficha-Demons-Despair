import { supabase, auth, db, isFirebaseQuotaExceeded, handleFirestoreError, collection, query, where, or, onSnapshot } from '../lib/supabase';
import { Character } from '../types';

const CHARACTERS_TABLE = 'characters';

const deepClean = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClean);
  
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
    console.warn("⚠️ [Supabase] Tentativa de salvar sem usuário logado.");
    return;
  }

  const isOwnEmail = character.userEmail === auth.currentUser.email;
  const targetUserId = isOwnEmail ? auth.currentUser.uid : (character.userId || auth.currentUser.uid);
  const targetUserEmail = character.userEmail || auth.currentUser.email || "";

  console.log(`💾 [Supabase] Salvando ficha: ${character.nome} (${character.id})`);

  try {
    const cleanCharacter = deepClean(character);
    cleanCharacter.userId = targetUserId;
    cleanCharacter.userEmail = targetUserEmail;

    const { error } = await supabase
      .from(CHARACTERS_TABLE)
      .upsert({
        id: character.id,
        user_id: targetUserId,
        user_email: targetUserEmail,
        campaign_id: character.campaignId || null,
        data: cleanCharacter,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`❌ [Supabase] Erro ao salvar ${character.nome}:`, error);
      throw error;
    }
    console.log(`✅ [Supabase] Ficha ${character.nome} CONFIRMADA pelo servidor.`);
  } catch (error) {
    console.error(`❌ [Supabase] Exception ao salvar ${character.nome}:`, error);
  }
};

export const deleteCharacterFromFirestore = async (characterId: string) => {
  if (!auth.currentUser) return;

  try {
    const { error } = await supabase
      .from(CHARACTERS_TABLE)
      .delete()
      .eq('id', characterId);

    if (error) {
      console.error("[Supabase deleteCharacter] Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[Supabase deleteCharacter] Failed:", error);
  }
};

export const subscribeToUserCharacters = (
  userId: string,
  userEmail: string,
  onUpdate: (characters: Character[], metadata: { hasPendingWrites: boolean, fromCache: boolean }) => void
) => {
  if (!userId) return () => {};

  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Character] Firestore quota exceeded. Skipping snapshot listener.");
    return () => {};
  }

  let active = true;

  const q = userEmail
    ? query(
        collection(db, CHARACTERS_TABLE),
        or(where('user_id', '==', userId), where('user_email', '==', userEmail))
      )
    : query(
        collection(db, CHARACTERS_TABLE),
        where('user_id', '==', userId)
      );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active) return;
    try {
      const characters: Character[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData && docData.data) {
          const char = { ...docData.data } as Character;
          if (!char.userId && docData.user_id) char.userId = docData.user_id;
          if (!char.userEmail && docData.user_email) char.userEmail = docData.user_email;
          characters.push(char);
        }
      });
      onUpdate(characters, { hasPendingWrites: false, fromCache: false });
    } catch (e) {
      console.error("[subscribeToUserCharacters onSnapshot] Error:", e);
    }
  }, (error) => {
    console.error("[subscribeToUserCharacters onSnapshot] Listener error:", error);
    try {
      handleFirestoreError(error, 'get', CHARACTERS_TABLE);
    } catch (err) {
      // Ignora erro relançado para não quebrar a aplicação
    }
  });

  return () => {
    active = false;
    unsubscribe();
  };
};
