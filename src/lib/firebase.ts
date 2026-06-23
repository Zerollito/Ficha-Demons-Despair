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
    enableMultiTabIndexedDbPersistence,
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
    experimentalForceLongPolling: true, // Forçar long polling pode ser mais estável em iframes do AI Studio
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Informar sobre o estado do computador
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => console.log("Conexão com a Internet restaurada."));
    window.addEventListener('offline', () => console.warn("Conexão com a Internet perdida. Operando em modo offline."));
}

// Ativando persistência multi-aba para suporte offline completo e prevenção de escritas presas
if (typeof window !== 'undefined') {
    enableMultiTabIndexedDbPersistence(db).then(() => {
        console.log("Persistência multi-aba do Firestore habilitada com sucesso.");
    }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Persistência do Firestore: múltipla abas abertas.");
        } else if (err.code === 'unimplemented') {
            console.warn("Persistência do Firestore: navegador não suportado para offline.");
        } else {
            console.warn("Não foi possível habilitar a persistência offline do Firestore:", err);
        }
    });
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

export function isFirebaseQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as any).firebaseQuotaExceeded) return true;
  
  const exceededStr = localStorage.getItem('firebase_quota_exceeded');
  if (exceededStr) {
    try {
      const { timestamp } = JSON.parse(exceededStr);
      // Cota reseta diariamente. Consideramos excedido se definido nas últimas 12 horas.
      if (Date.now() - timestamp < 12 * 60 * 60 * 1000) {
        (window as any).firebaseQuotaExceeded = true;
        return true;
      } else {
        localStorage.removeItem('firebase_quota_exceeded');
      }
    } catch {
      localStorage.removeItem('firebase_quota_exceeded');
    }
  }
  return false;
}

export function setFirebaseQuotaExceeded() {
  if (typeof window === 'undefined') return;
  if (!(window as any).firebaseQuotaExceeded) {
    (window as any).firebaseQuotaExceeded = true;
    try {
      localStorage.setItem('firebase_quota_exceeded', JSON.stringify({
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Erro ao salvar flag de cota excedida no localStorage:', e);
    }
    window.dispatchEvent(new CustomEvent("firebase-quota-exceeded"));
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errText = error instanceof Error ? error.message : String(error);
  const errCode = (error && typeof error === 'object' && 'code' in error) ? String((error as any).code) : '';
  
  const isQuota = errText.toLowerCase().includes('resource-exhausted') || 
                  errText.toLowerCase().includes('quota limit exceeded') || 
                  errText.toLowerCase().includes('quota') ||
                  errCode === 'resource-exhausted' ||
                  errCode.toLowerCase().includes('quota');

  const errInfo: FirestoreErrorInfo = {
    error: errText,
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

  if (isQuota) {
    console.warn('⚠️ [Firestore Quota] Firestore Error (Quota Exceeded): ', errorMessage);
    setFirebaseQuotaExceeded();
    return; // Retorna com segurança sem estourar exceções para não travar a aplicação
  }

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

/**
 * Limpa o cache local do Firestore. Útil se a sincronização ficar travada.
 */
export async function clearFirestoreCache() {
  const { terminate, clearIndexedDbPersistence } = await import('firebase/firestore');
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
    console.log("Cache do Firestore limpo com sucesso. Recarregando...");
    window.location.reload();
  } catch (error) {
    console.error("Erro ao limpar cache do Firestore:", error);
  }
}
