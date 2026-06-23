import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType, isFirebaseQuotaExceeded } from "../lib/firebase";
import { BestiaryMonster } from "../types";

const COLLECTION_NAME = "bestiary";

export const saveMonsterToBestiary = async (monster: BestiaryMonster) => {
  if (!auth.currentUser) return;
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Não é possível salvar monstro: Limite de cota diário excedido.");
    return;
  }
  
  const monsterRef = doc(db, COLLECTION_NAME, monster.id);
  const monsterData = {
    ...monster,
    masterId: auth.currentUser.uid,
    createdAt: monster.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    // Clean undefined values
    const cleanData = Object.fromEntries(
      Object.entries(monsterData).filter(([_, v]) => v !== undefined)
    );
    await setDoc(monsterRef, cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${monster.id}`);
  }
};

export const deleteMonsterFromBestiary = async (monsterId: string) => {
  if (!auth.currentUser) return;
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Não é possível excluir monstro: Limite de cota diário excedido.");
    return;
  }
  const monsterRef = doc(db, COLLECTION_NAME, monsterId);
  try {
    await deleteDoc(monsterRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${monsterId}`);
  }
};

export const subscribeToBestiary = (callback: (monsters: BestiaryMonster[]) => void) => {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION_NAME),
    where("masterId", "==", auth.currentUser.uid),
    orderBy("name", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const monsters = snapshot.docs.map(doc => doc.data() as BestiaryMonster);
    callback(monsters);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    callback([]);
  });
};
