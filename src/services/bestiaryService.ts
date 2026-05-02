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
import { db, auth } from "../lib/firebase";
import { BestiaryMonster } from "../types";

const COLLECTION_NAME = "bestiary";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveMonsterToBestiary = async (monster: BestiaryMonster) => {
  if (!auth.currentUser) return;
  
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
