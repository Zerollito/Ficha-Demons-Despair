import { collection, doc, deleteDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirebaseQuotaExceeded } from '../lib/firebase';
import { MaterialData } from '../data/materials';

export const subscribeToMaterials = (masterId: string, callback: (materials: MaterialData[]) => void) => {
  const q = query(collection(db, 'materials'), where('masterId', '==', masterId));
  
  return onSnapshot(q, (snapshot) => {
    const materials: MaterialData[] = [];
    snapshot.forEach((doc) => {
      materials.push(doc.data() as MaterialData);
    });
    callback(materials);
  }, (error) => {
    const isQuota = String(error?.message || error).toLowerCase().includes('quota') || 
                    String(error?.message || error).toLowerCase().includes('resource-exhausted');
    if (!isQuota) {
      console.error("Error subscribing to materials:", error);
    }
    handleFirestoreError(error, OperationType.LIST, 'materials');
  });
};

export const saveMaterial = async (masterId: string, material: MaterialData) => {
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Não é possível salvar material: Limite de cota diário excedido.");
    return;
  }
  try {
    await setDoc(doc(db, 'materials', material.id), { ...material, masterId });
  } catch (error) {
    const isQuota = String(error?.message || error).toLowerCase().includes('quota') || 
                    String(error?.message || error).toLowerCase().includes('resource-exhausted');
    if (!isQuota) {
      console.error("Error saving material:", error);
    }
    handleFirestoreError(error, OperationType.WRITE, `materials/${material.id}`);
  }
};

export const deleteMaterial = async (materialId: string) => {
  if (isFirebaseQuotaExceeded()) {
    console.warn("⚠️ [Firestore] Não é possível excluir material: Limite de cota diário excedido.");
    return;
  }
  try {
    await deleteDoc(doc(db, 'materials', materialId));
  } catch (error) {
    const isQuota = String(error?.message || error).toLowerCase().includes('quota') || 
                    String(error?.message || error).toLowerCase().includes('resource-exhausted');
    if (!isQuota) {
      console.error("Error deleting material:", error);
    }
    handleFirestoreError(error, OperationType.DELETE, `materials/${materialId}`);
  }
};
