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
    // Only set owner if it's missing (new character)
    userId: character.userId || auth.currentUser.uid,
    userEmail: character.userEmail || auth.currentUser.email,
    updatedAt: serverTimestamp(),
  };

  try {
    // Clean undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    await setDoc(charRef, cleanData, { merge: true });
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
      // Basic sanitization to ensure essential structures exist before reaching the UI
      return {
        nome: "Personagem sem nome",
        etnia: "",
        dinheiro: { C: 0, B: 0, P: 0, O: 0 },
        vidaAtual: 0,
        manaAtual: 0,
        fome: 100,
        sede: 100,
        cansaco: 8,
        defesa: { Cabeça: 0, Torso: 0, Braços: 0, Pernas: 0 },
        stats: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
        statsXP: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
        bonusProficiencias: {},
        userEmail: "",
        joias: [],
        armas: [],
        catalisadores: [],
        habilidades: [],
        magias: [],
        armaduras: [],
        acessorios: [],
        compartimentos: [],
        conhecimentos: [],
        escalas: [],
        efeitosNegativos: [],
        anotacoes: [],
        dadosCustomizados: [],
        imagens: [],
        ...data
      } as Character;
    });
    onUpdate(characters);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, CHARACTERS_COLLECTION);
  });
};
