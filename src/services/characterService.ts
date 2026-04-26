import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Character } from '../types';

const CHARACTERS_COLLECTION = 'characters';

export const saveCharacterToFirestore = async (character: Character) => {
  if (!auth.currentUser) return;

  const charRef = doc(db, CHARACTERS_COLLECTION, character.id);
  const data = {
    ...character,
    userId: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(charRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${CHARACTERS_COLLECTION}/${character.id}`);
  }
};

export const deleteCharacterFromFirestore = async (characterId: string) => {
  if (!auth.currentUser) return;

  const charRef = doc(db, CHARACTERS_COLLECTION, characterId);

  try {
    await deleteDoc(charRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CHARACTERS_COLLECTION}/${characterId}`);
  }
};

export const subscribeToUserCharacters = (onUpdate: (characters: Character[]) => void) => {
  if (!auth.currentUser) return () => {};

  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    where('userId', '==', auth.currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const characters = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Timestamps if needed or just return data as any to match Character
      return data as Character;
    });
    onUpdate(characters);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CHARACTERS_COLLECTION);
  });
};
