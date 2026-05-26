import { collection, doc, deleteDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
    console.error("Error subscribing to materials:", error);
  });
};

export const saveMaterial = async (masterId: string, material: MaterialData) => {
  try {
    await setDoc(doc(db, 'materials', material.id), { ...material, masterId });
  } catch (error) {
    console.error("Error saving material:", error);
    throw error;
  }
};

export const deleteMaterial = async (materialId: string) => {
  try {
    await deleteDoc(doc(db, 'materials', materialId));
  } catch (error) {
    console.error("Error deleting material:", error);
    throw error;
  }
};
