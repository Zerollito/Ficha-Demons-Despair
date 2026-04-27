import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult, 
    onAuthStateChanged, 
    User, 
    setPersistence, 
    browserLocalPersistence 
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, query, where, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Character } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

// Configurar persistência local de forma agressiva para evitar perda de estado em WebViews/Iframes
const initAuth = async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        console.log("Persistência do Firebase Auth configurada como Local.");
    } catch (err) {
        console.error("Erro ao definir persistência:", err);
    }
};
initAuth();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ 
    prompt: 'select_account',
    // Adicionando parâmetros para melhor compatibilidade com webviews
    display: 'touch' 
});

// Connection test
async function testConnection() {
  try {
    // Try to get the test connection document
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    console.error("Firestore connection test failed:", error);
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}
testConnection();

export enum OperationType {
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
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing to avoid crashing the whole app; relying on logging and UI feedback
}

// Auth Helpers
export const handleRedirectResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log("Login via redirect detectado e processado.");
            return result.user;
        }
    } catch (error) {
        console.error("Erro ao processar resultado do redirect:", error);
    }
    return null;
};

export const loginWithGoogle = async () => {
    // Detecta se é mobile ou webview para preferir redirect se necessário
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIframe = window.top !== window.self;
    
    if (isMobile || isIframe) {
        console.log("Ambiente restrito detectado. Usando Redirect em vez de Popup.");
        try {
            await signInWithRedirect(auth, googleProvider);
            return;
        } catch (error) {
            console.error("Erro no Redirect:", error);
        }
    }

    try {
        console.log("Iniciando login com popup...");
        // Tentamos popup primeiro, é a melhor experiência
        await signInWithPopup(auth, googleProvider);
        console.log("Login finalizado com sucesso.");
    } catch (error: any) {
        console.error("Erro no login:", error);
        
        // Se o erro for de inicialização ou popup bloqueado em mobile, podemos sugerir o redirect
        if (error.code === 'auth/popup-blocked' || error.message?.includes('missing initial state')) {
          console.warn("Detectado erro de estado inicial ou popup bloqueado. Tentando Redirect...");
          try {
              await signInWithRedirect(auth, googleProvider);
          } catch (reErr) {
              console.error("Erro no fallback de redirect:", reErr);
          }
        } else {
            throw error;
        }
    }
};

export const logout = () => auth.signOut();
