import { supabase, auth, db, isFirebaseQuotaExceeded, handleFirestoreError, collection, query, where, or, onSnapshot, isNetworkError, safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/supabase';
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

export const saveCharacterToSupabase = async (character: Character) => {
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

      fetch(`/api/campaigns/${encodeURIComponent(character.campaignId)}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character })
      }).catch(() => {});
    } catch (e) {
      console.error("Error updating campaign character local cache:", e);
    }
  }

  const userEmail = (character.userEmail || auth.currentUser?.email || "").trim().toLowerCase();
  if (!userEmail) {
    console.warn("⚠️ [Supabase] Tentativa de salvar ficha sem email associado.");
    return;
  }

  console.log(`💾 [Supabase] Salvando ficha para ${userEmail}: ${character.nome} (${character.id})`);

  try {
    const cleanCharacter = deepClean(character);
    delete (cleanCharacter as any).userId;
    cleanCharacter.userEmail = userEmail;

    const { error } = await supabase
      .from(CHARACTERS_TABLE)
      .upsert({
        id: character.id,
        user_id: userEmail,
        user_email: userEmail,
        campaign_id: character.campaignId || null,
        data: cleanCharacter,
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (isNetworkError(error)) {
        console.warn(`⚠️ [Supabase] Problema de conexão ao salvar ${character.nome} (salvo localmente):`, error.message || error);
      } else {
        console.error(`❌ [Supabase] Erro ao salvar ${character.nome}:`, error);
      }
      throw error;
    }
    console.log(`✅ [Supabase] Ficha ${character.nome} CONFIRMADA pelo servidor.`);
  } catch (error: any) {
    if (isNetworkError(error)) {
      console.warn(`⚠️ [Supabase] Problema de rede ao salvar ${character.nome} (mantendo em modo offline):`, error.message || error);
    } else {
      console.error(`❌ [Supabase] Exception ao salvar ${character.nome}:`, error);
    }
  }
};

export const saveCharacter = saveCharacterToSupabase;
export const saveCharacterToFirestore = saveCharacterToSupabase;

export const getDeletedCharactersBlacklist = (): Set<string> => {
  try {
    const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('deleted_characters_blacklist') || localStorage.getItem('demons_despair_deleted_chars')) : null;
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
};

export const addCharacterToDeletedBlacklist = (characterId: string) => {
  try {
    if (!characterId) return;
    const raw = safeLocalStorageGetItem('deleted_characters_blacklist') || (typeof localStorage !== 'undefined' ? localStorage.getItem('deleted_characters_blacklist') : null);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(characterId)) {
      list.push(characterId);
      const jsonStr = JSON.stringify(list);
      safeLocalStorageSetItem('deleted_characters_blacklist', jsonStr);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('deleted_characters_blacklist', jsonStr);
        localStorage.setItem('demons_despair_deleted_chars', jsonStr);
      }
    }
  } catch (e) {}
};

export const deleteCharacterFromSupabase = async (characterId: string) => {
  if (!characterId) return;

  // 1. Mark in persistent blacklist so it is never rescued or resurrected by offline caches
  addCharacterToDeletedBlacklist(characterId);

  // 2. Purge from main app state in localStorage / IndexedDB so reopen never brings it back
  try {
    const rawState = safeLocalStorageGetItem('rpg_app_state') || (typeof localStorage !== 'undefined' ? localStorage.getItem('rpg_app_state') : null);
    if (rawState) {
      const parsed = JSON.parse(rawState);
      if (parsed && Array.isArray(parsed.characters)) {
        parsed.characters = parsed.characters.filter((c: any) => c.id !== characterId);
        if (parsed.activeCharacterId === characterId) {
          parsed.activeCharacterId = parsed.characters.length > 0 ? parsed.characters[0].id : '';
        }
        safeLocalStorageSetItem('rpg_app_state', JSON.stringify(parsed));
      }
    }
  } catch (e) {}

  // 3. Purge from local table caches immediately
  try {
    const raw = safeLocalStorageGetItem('supabase_table_characters');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter((c: any) => c.id !== characterId && c.data?.id !== characterId);
        safeLocalStorageSetItem('supabase_table_characters', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  try {
    const raw = safeLocalStorageGetItem('rpg_chars_history_backup');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter((c: any) => c.id !== characterId && c.data?.id !== characterId);
        safeLocalStorageSetItem('rpg_chars_history_backup', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  try {
    const raw = safeLocalStorageGetItem('rpg_system_x_chars');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.characters)) {
        parsed.characters = parsed.characters.filter((c: any) => c.id !== characterId);
        safeLocalStorageSetItem('rpg_system_x_chars', JSON.stringify(parsed));
      }
    }
  } catch (e) {}

  // 4. Purge from campaign character caches and token caches
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('campaign_characters_') || key.startsWith('vtt_tokens_'))) {
          const stored = safeLocalStorageGetItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter((c: any) => c.id !== characterId && c.characterId !== characterId);
                safeLocalStorageSetItem(key, JSON.stringify(filtered));
              }
            } catch (err) {}
          }
        }
      }
    } catch (e) {}
  }

  // 5. Dispatch local event to remove immediately from all views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('supabase_local_change_characters'));
    window.dispatchEvent(new CustomEvent('supabase_local_change_characters'));
  }

  // 6. Always invoke supabase.from(CHARACTERS_TABLE).delete() to purge from local Supabase table and remote
  try {
    const { error } = await supabase
      .from(CHARACTERS_TABLE)
      .delete()
      .eq('id', characterId);

    if (error) {
      console.error("[Supabase deleteCharacter] Error:", error);
    } else {
      console.log(`🗑️ [Supabase] Ficha ${characterId} excluída com sucesso do banco local e remoto.`);
    }
  } catch (error) {
    console.error("[Supabase deleteCharacter] Exception:", error);
  }
};

export const deleteCharacter = deleteCharacterFromSupabase;
export const deleteCharacterFromFirestore = deleteCharacterFromSupabase;

export const subscribeToUserCharacters = (
  userIdOrEmail: string,
  userEmail: string,
  onUpdate: (characters: Character[], metadata: { hasPendingWrites: boolean, fromCache: boolean }) => void
) => {
  const cleanEmail = (userEmail || userIdOrEmail || auth.currentUser?.email || "").trim().toLowerCase();
  if (!cleanEmail) {
    onUpdate([], { hasPendingWrites: false, fromCache: false });
    return () => {};
  }

  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Character] Firestore quota exceeded. Skipping snapshot listener.");
    return () => {};
  }

  let active = true;

  const q = query(
    collection(db, CHARACTERS_TABLE),
    where('user_email', '==', cleanEmail)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active) return;
    try {
      const characters: Character[] = [];
      const blacklist = getDeletedCharactersBlacklist();
      
      snapshot.forEach((doc) => {
        const docData = doc.data();
        if (!docData) return;
        
        let charData: any = docData.data;
        if (typeof charData === 'string') {
          try { charData = JSON.parse(charData); } catch (e) { charData = docData; }
        } else if (!charData || typeof charData !== 'object') {
          charData = docData;
        }

        const char = { ...docData, ...charData } as Character;
        if (!char.userEmail && docData.user_email) char.userEmail = docData.user_email;
        delete (char as any).userId;

        if (char.id && !blacklist.has(char.id) && (char.nome !== undefined || (char as any).atributos !== undefined)) {
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

export const getMaxCapacity = (weapon: any): number => {
  if (!weapon) return 6;
  const isBow = (weapon.categoria || "").toLowerCase() === "arco" || (weapon.tipo || "").toLowerCase().includes("arco");
  const total = weapon.municaoTotal !== undefined && weapon.municaoTotal !== null && weapon.municaoTotal !== 0 ? Number(weapon.municaoTotal) : null;
  const pente = weapon.capacidadePente !== undefined && weapon.capacidadePente !== null && weapon.capacidadePente !== 0 ? Number(weapon.capacidadePente) : null;
  
  if (total !== null && !isNaN(total)) return total;
  if (pente !== null && !isNaN(pente)) return pente;
  return isBow ? 20 : 6;
};

export const handleReload = async (
  char: Character,
  weaponId: string,
  ammoId: string,
  updateCharacterState: (charId: string, updates: any) => Promise<void>,
  addCombatLog: (campaignId: string, log: any) => Promise<void>,
  campaignId: string
) => {
  let weapon = char.armas.find(w => w.id === weaponId);
  const inventoryItems = char.compartimentos?.flatMap(c => c.itens || []) || [];
  if (!weapon) {
    weapon = inventoryItems.find(i => i.id === weaponId) as any;
  }
  if (!weapon) return;

  const isBow = (weapon.categoria || "").toLowerCase() === "arco" || (weapon.tipo || "").toLowerCase().includes("arco");
  const ammo = inventoryItems.find(i => i.id === ammoId);
  if (!ammo || (ammo.quantidade || 0) <= 0) {
    await addCombatLog(campaignId, { msg: isBow ? "Você não possui flechas!" : "Você não possui munição!", type: 'error' });
    return;
  }

  const currentMagazine = (weapon as any).magazineAmmo || [];
  const maxCapacity = getMaxCapacity(weapon);
  
  if (currentMagazine.length >= maxCapacity) {
    await addCombatLog(campaignId, { msg: isBow ? "A aljava/arco já está com capacidade máxima!" : "O pente já está cheio!", type: 'error' });
    return;
  }

  const amountToLoad = 1;
  const charUpdates: any = {};
  const { generateId } = await import('../lib/random');
  const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...ammo as any, id: generateId(), quantidade: 1 }));
  const newMagazine = [...currentMagazine, ...ammoToAdd];

  const updatedWeaponProps = {
    ...weapon,
    municaoCarregada: newMagazine.length,
    magazineAmmo: newMagazine,
    bulletId: !isBow ? ammo.id : undefined,
    arrowId: isBow ? ammo.id : undefined,
    corte: Number(ammo.corte) || 0,
    perfuracao: Number(ammo.perfuracao) || 0,
    impacto: Number(ammo.impacto) || 0,
    resistencia: Number(ammo.resistencia) || 0,
    ...(ammo.dano ? { municaoDano: ammo.dano } : {})
  };

  charUpdates.armas = char.armas.map(w => w.id === weaponId ? updatedWeaponProps : w);
  charUpdates.compartimentos = char.compartimentos.map(comp => ({
    ...comp,
    itens: comp.itens.map(it => {
      if (it.id === ammoId) {
        return { ...it, quantidade: Math.max(0, (it.quantidade || 0) - amountToLoad) };
      }
      if (it.id === weaponId) {
        return updatedWeaponProps;
      }
      return it;
    })
  }));

  await updateCharacterState(char.id, charUpdates);
  await addCombatLog(campaignId, { msg: `${char.nome} recarregou 1 ${isBow ? 'flecha' : 'munição'} (${ammo.nome}) em ${weapon.nome}.`, type: 'info' });
};

export const handleReloadAll = async (
  char: Character,
  weaponId: string,
  ammoId: string,
  updateCharacterState: (charId: string, updates: any) => Promise<void>,
  addCombatLog: (campaignId: string, log: any) => Promise<void>,
  campaignId: string
) => {
  let weapon = char.armas.find(w => w.id === weaponId);
  const inventoryItems = char.compartimentos?.flatMap(c => c.itens || []) || [];
  if (!weapon) {
    weapon = inventoryItems.find(i => i.id === weaponId) as any;
  }
  if (!weapon) return;

  const isBow = (weapon.categoria || "").toLowerCase() === "arco" || (weapon.tipo || "").toLowerCase().includes("arco");
  const ammo = inventoryItems.find(i => i.id === ammoId);
  if (!ammo || (ammo.quantidade || 0) <= 0) {
    await addCombatLog(campaignId, { msg: isBow ? "Você não possui flechas!" : "Você não possui munição!", type: 'error' });
    return;
  }

  const currentMagazine = (weapon as any).magazineAmmo || [];
  const maxCapacity = getMaxCapacity(weapon);
  
  if (currentMagazine.length >= maxCapacity) {
    await addCombatLog(campaignId, { msg: isBow ? "A aljava/arco já está com capacidade máxima!" : "O pente já está cheio!", type: 'error' });
    return;
  }

  const needed = maxCapacity - currentMagazine.length;
  const amountToLoad = Math.min(ammo.quantidade || 0, needed);
  
  const charUpdates: any = {};
  const { generateId } = await import('../lib/random');
  const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...ammo as any, id: generateId(), quantidade: 1 }));
  const newMagazine = [...currentMagazine, ...ammoToAdd];

  const updatedWeaponProps = {
    ...weapon,
    municaoCarregada: newMagazine.length,
    magazineAmmo: newMagazine,
    bulletId: !isBow ? ammo.id : undefined,
    arrowId: isBow ? ammo.id : undefined,
    corte: Number(ammo.corte) || 0,
    perfuracao: Number(ammo.perfuracao) || 0,
    impacto: Number(ammo.impacto) || 0,
    resistencia: Number(ammo.resistencia) || 0,
    ...(ammo.dano ? { municaoDano: ammo.dano } : {})
  };

  charUpdates.armas = char.armas.map(w => w.id === weaponId ? updatedWeaponProps : w);
  charUpdates.compartimentos = char.compartimentos.map(comp => ({
    ...comp,
    itens: comp.itens.map(it => {
      if (it.id === ammoId) {
        return { ...it, quantidade: Math.max(0, (it.quantidade || 0) - amountToLoad) };
      }
      if (it.id === weaponId) {
        return updatedWeaponProps;
      }
      return it;
    })
  }));

  await updateCharacterState(char.id, charUpdates);
  await addCombatLog(campaignId, { msg: `${char.nome} recarregou ${amountToLoad} ${isBow ? 'flechas' : 'munições'} (${ammo.nome}) em ${weapon.nome}.`, type: 'info' });
};

export const handleMaintenance = async (
  char: Character,
  weaponId: string,
  updateCharacterState: (charId: string, updates: any) => Promise<void>,
  addCombatLog: (campaignId: string, log: any) => Promise<void>,
  campaignId: string
) => {
  let weapon = char.armas.find(w => w.id === weaponId);
  const inventoryItems = char.compartimentos?.flatMap(c => c.itens || []) || [];
  if (!weapon) {
    weapon = inventoryItems.find(i => i.id === weaponId) as any;
  }
  if (!weapon) return;

  const charUpdates: any = {};
  const maxDur = (weapon as any).durabilidadeMaxUtil || weapon.maxDurabilidade || 10;

  charUpdates.armas = char.armas.map(w => w.id === weaponId ? { ...w, durabilidade: maxDur } : w);
  charUpdates.compartimentos = char.compartimentos.map(comp => ({
    ...comp,
    itens: comp.itens.map((it: any) => it.id === weaponId ? { ...it, durabilidade: maxDur } : it)
  }));

  await updateCharacterState(char.id, charUpdates);
  await addCombatLog(campaignId, { msg: `${char.nome} realizou a manutenção de "${weapon.nome}". Durabilidade útil restaurada para ${maxDur}!`, type: 'success' });
};
