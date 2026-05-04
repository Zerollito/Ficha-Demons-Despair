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
import { 
    initializeFirestore, 
    enableIndexedDbPersistence,
    doc, 
    getDocFromServer, 
    collection, 
    query, 
    where, 
    onSnapshot, 
    setDoc, 
    deleteDoc, 
    updateDoc, 
    serverTimestamp, 
    Timestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Character } from '../types';

const app = initializeApp(firebaseConfig);

// Inicializar Firestore com configurações otimizadas para o ambiente de preview
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true, // Frequentemente necessário em ambientes de proxy/sandboxed
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Habilitar persistência offline
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            // Provavelmente múltiplas abas abertas
            console.warn("Persistência do Firestore: múltipla abas abertas.");
        } else if (err.code === 'unimplemented') {
            // O navegador não suporta
            console.warn("Persistência do Firestore: navegador não suportado.");
        }
    });
} catch (e) {
    console.error("Erro ao habilitar persistência:", e);
}

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
// Garantir que a persistência seja iniciada imediatamente
const persistencePromise = initAuth();

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
    console.log("Firestore connection test status (standard for new projects):", error);
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
  const errorMessage = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorMessage);
  throw new Error(errorMessage);
}

// Auth Helpers
export const handleRedirectResult = async () => {
    try {
        console.log("Checando resultado do redirect de login... Origin:", window.location.origin);
        await persistencePromise; // Aguarda a persistência estar definida
        const result = await getRedirectResult(auth);
        if (result) {
            console.log("Login via redirect detectado e processado com sucesso:", result.user.email);
            return result.user;
        }
        console.log("Nenhum resultado de redirect encontrado.");
    } catch (error: any) {
        console.error("Erro ao processar resultado do redirect:", error.code, error.message);
        if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/unauthorized-client') {
            console.error("ERRO CRITICAL: Domínio não autorizado no Firebase Console. Adicione", window.location.origin, "aos domínios autorizados.");
        }
    }
    return null;
};

export const loginWithGoogle = async () => {
    await persistencePromise; // Aguarda a persistência estar definida

    console.log("Tentando login com Google... Origin:", window.location.origin);
    
    // Tentamos popup primeiro SEMPRE, mesmo em iframe, pois é mais estável no ambiente de preview
    try {
        console.log("Tentando signInWithPopup...");
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Login com Popup bem sucedido:", result.user.email);
        return result.user;
    } catch (error: any) {
        console.warn("Falha no signInWithPopup:", error.code, error.message);
        
        // Se o popup foi bloqueado ou estamos em um ambiente que exige redirect ou erro genérico de janela
        if (error.code === 'auth/popup-blocked' || 
            error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request' ||
            error.code === 'auth/internal-error' ||
            error.code === 'auth/operation-not-allowed' ||
            /iPad|iPhone|iPod/.test(navigator.userAgent) || // Safari mobile geralmente bloqueia popups agressivamente
            window.top !== window.self // Estamos em iframe
        ) {
            console.log("Ambiente restrito ou popup bloqueado. Tentando fallback para signInWithRedirect...");
            try {
                await signInWithRedirect(auth, googleProvider);
            } catch (redirError: any) {
                console.error("Erro fatal no Redirect:", redirError.code, redirError.message);
                if (redirError.code === 'auth/unauthorized-domain') {
                    console.error("ERRO: Domínio não autorizado. Verifique as configurações do Firebase.");
                }
                throw redirError;
            }
        } else {
            throw error;
        }
    }
};

export const logout = () => auth.signOut();
