import { createClient } from '@supabase/supabase-js';
import {
  safeLocalStorageSetItem,
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  stripHeavyDataForCache,
  idbGet,
} from './storageManager';

export {
  safeLocalStorageSetItem,
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  stripHeavyDataForCache,
  idbGet,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Read and configure local Supabase on PC
export const normalizeSupabaseUrl = (url: string): string => {
  let clean = (url || "").trim();
  if (clean.endsWith("/")) clean = clean.slice(0, -1);
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'http://' + clean;
  }
  return clean;
};

export const generateRandomUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  const rand = () => Math.random();
  const hex = (val: number) => Math.floor(val).toString(16).padStart(2, '0');
  const parts = [
    Array.from({ length: 4 }, () => hex(rand() * 256)).join(''),
    Array.from({ length: 2 }, () => hex(rand() * 256)).join(''),
    hex(64 + (rand() * 16)) + hex(rand() * 256), // v4 format (4 chars)
    hex(128 + (rand() * 64)) + hex(rand() * 256), // variant format (4 chars)
    Array.from({ length: 6 }, () => hex(rand() * 256)).join('')
  ];
  return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
};

export const getDeterministicUuid = (input: string): string => {
  let hash = 0;
  const cleanInput = (input || "").trim().toLowerCase();
  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const seedRandom = (s: number) => {
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  };
  const rand = seedRandom(Math.abs(hash) || 987654321);
  const hex = (val: number) => Math.floor(val).toString(16).padStart(2, '0');
  const parts = [
    Array.from({ length: 4 }, () => hex(rand() * 256)).join(''),
    Array.from({ length: 2 }, () => hex(rand() * 256)).join(''),
    hex(64 + (rand() * 16)) + hex(rand() * 256), // v4 format (4 chars)
    hex(128 + (rand() * 64)) + hex(rand() * 256), // variant format (4 chars)
    Array.from({ length: 6 }, () => hex(rand() * 256)).join('')
  ];
  return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
};

export const STANDARD_LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNRebZhBc_4bXn6U";
export const DEFAULT_LOCAL_ANON_KEY = STANDARD_LOCAL_ANON_KEY;
export const STANDARD_LOCAL_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM7JyUXp7fZ83VvlN-BRwsPIgtcqbyUTR21s-TqF4";
export const LOCAL_SERVICE_ROLE_KEY = STANDARD_LOCAL_SERVICE_ROLE_KEY;

export const getSupabaseConfig = () => {
  let savedUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_custom_url') : null;
  let savedKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_custom_anon_key') : null;

  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? (window.location.hostname || 'localhost') : 'localhost';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';

  // If accessed outside localhost (e.g. cloudflared tunnel, mobile device, remote domain, LAN IP):
  // Default to window.location.origin so requests go through the backend proxy on port 3000 to the host PC's Supabase!
  let defaultUrl = "http://127.0.0.1:54321";
  if (isBrowser && !isLocalHost) {
    defaultUrl = window.location.origin;
  }

  let currentUrl = (savedUrl || defaultUrl).trim();
  
  // If the user is on a remote device/tunnel, but has saved a raw "127.0.0.1" / "localhost" URL from before,
  // automatically redirect it through window.location.origin so mobile doesn't attempt to connect to itself!
  if (isBrowser && !isLocalHost && (currentUrl.includes('127.0.0.1') || currentUrl.includes('localhost') || currentUrl.includes('::1'))) {
    currentUrl = window.location.origin;
  }

  let currentKey = (savedKey || DEFAULT_LOCAL_ANON_KEY).trim();
  // Se a chave no storage for a antiga chave 'sb_publishable_' ou estiver vazia, substitui pela chave oficial do Supabase local
  if (!currentKey || currentKey.startsWith('sb_publishable_')) {
    currentKey = STANDARD_LOCAL_ANON_KEY;
    if (isBrowser) {
      try {
        localStorage.setItem('supabase_custom_anon_key', currentKey);
      } catch (e) {}
    }
  }

  return {
    url: normalizeSupabaseUrl(currentUrl),
    rawUrl: currentUrl,
    anonKey: currentKey
  };
};

export const isLocalUrl = (url: string) => {
  const u = (url || '').toLowerCase();
  const isBrowser = typeof window !== 'undefined';
  const origin = isBrowser ? (window.location.origin || '').toLowerCase() : '';
  const hostname = isBrowser ? (window.location.hostname || '').toLowerCase() : '';
  return u.includes('127.0.0.1') || 
         u.includes('localhost') || 
         u.includes('::1') || 
         u.includes('0.0.0.0') || 
         u.includes('192.168.') || 
         u.includes('10.') || 
         u.includes('ngrok') || 
         u.includes('cloudflare') ||
         u.includes('.app.br') ||
         u.includes('.run.app') ||
         (origin && u.startsWith(origin)) ||
         (hostname && u.includes(hostname));
};

let currentConfig = getSupabaseConfig();

export let realSupabaseClient = createClient(currentConfig.url, currentConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export let hasActiveRealSession = false;

export let isSupabaseConnected = true;

export const setSupabaseConnectionState = (connected: boolean) => {
  if (isSupabaseConnected !== connected) {
    isSupabaseConnected = connected;
    console.log(`📡 [Supabase Connection] State changed to: ${connected ? 'CONNECTED' : 'CACHE_ONLY'}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase_connection_status_changed', { 
        detail: { connected } 
      }));
    }
  }
};

console.log("⚡ [Supabase Local] Inicializado com:", currentConfig.url);

export const setSupabaseConfig = (newUrl: string, newAnonKey?: string) => {
  const normUrl = normalizeSupabaseUrl(newUrl);
  const cleanKey = (newAnonKey || currentConfig.anonKey).trim();
  if (typeof window !== 'undefined') {
    localStorage.setItem('supabase_custom_url', normUrl);
    if (newAnonKey) {
      localStorage.setItem('supabase_custom_anon_key', cleanKey);
    }
  }
  currentConfig = { url: normUrl, rawUrl: newUrl, anonKey: cleanKey };
  realSupabaseClient = createClient(normUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });
  console.log("⚡ [Supabase Local] Cliente reconfigurado para:", normUrl);
  
  // Recheck session & attach auth state change for the new client!
  hasActiveRealSession = false;
  try {
    realSupabaseClient.auth.getSession().then(({ data: { session } }) => {
      hasActiveRealSession = !!session;
    }).catch(() => {});
    
    realSupabaseClient.auth.onAuthStateChange((event, session) => {
      hasActiveRealSession = !!session;
    });
  } catch (err) {
    console.warn("⚠️ [Supabase Local] Erro ao registrar onAuthStateChange na reconfiguração:", err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase_config_changed', { detail: { url: normUrl } }));
  }
};

export const testSupabaseConnection = async (targetUrl?: string, targetKey?: string): Promise<{ success: boolean; message: string; latency?: number }> => {
  const urlToTest = normalizeSupabaseUrl(targetUrl || currentConfig.url);
  const keyToTest = (targetKey || currentConfig.anonKey).trim();
  
  // 1. Tentar primeiro via browser fetch direto
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${urlToTest}/auth/v1/health`, {
      headers: keyToTest ? { apikey: keyToTest } : {},
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok || res.status < 500) {
      const lat = Date.now() - start;
      setSupabaseConnectionState(true);
      return { success: true, message: `Conectado com sucesso (${lat}ms)`, latency: lat };
    }
  } catch (err: any) {
    // 2. Se falhar no browser (ex: Mixed Content ou CORS ou rede), tentar via proxy de diagnóstico do servidor Express
    try {
      const pingUrl = `/api/supabase/ping?url=${encodeURIComponent(urlToTest)}&key=${encodeURIComponent(keyToTest)}`;
      const sRes = await fetch(pingUrl);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.online) {
          setSupabaseConnectionState(true);
          return { success: true, message: `Conectado via servidor (${sData.latency}ms)`, latency: sData.latency };
        } else {
          setSupabaseConnectionState(false);
          return { success: false, message: sData.error || "Supabase inacessível na URL especificada." };
        }
      }
    } catch (sErr: any) {}
    
    setSupabaseConnectionState(false);
    return { 
      success: false, 
      message: err.name === 'AbortError' 
        ? "Tempo limite esgotado (timeout 3s). A URL não respondeu." 
        : (err.message || "Erro de rede ao conectar ao Supabase") 
    };
  }
  setSupabaseConnectionState(false);
  return { success: false, message: "Resposta inesperada do Supabase." };
};

// Coletor e restaurador ultra-resiliente de fichas salvas no navegador
export const rescueAllLocalCharacters = (): any[] => {
  const foundMap = new Map<string, any>();
  const blacklist = (() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('deleted_characters_blacklist') : null;
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch (e) {
      return new Set<string>();
    }
  })();

  // Avalia a completude/riqueza de uma ficha para nunca substituir uma ficha completa por uma vazia
  const calculateRichness = (c: any): number => {
    if (!c || typeof c !== 'object') return 0;
    let score = 0;
    if (c.nome && c.nome !== 'Novo Personagem') score += 100;
    if (Array.isArray(c.armas) && c.armas.length > 0) score += c.armas.length * 20;
    if (Array.isArray(c.magias) && c.magias.length > 0) score += c.magias.length * 20;
    if (Array.isArray(c.habilidades) && c.habilidades.length > 0) score += c.habilidades.length * 15;
    if (Array.isArray(c.equipamentos) && c.equipamentos.length > 0) score += c.equipamentos.length * 10;
    if (c.atributos && typeof c.atributos === 'object') {
      const keys = Object.keys(c.atributos);
      score += keys.length * 5;
      for (const k of keys) {
        if (Number(c.atributos[k]) > 0) score += 10;
      }
    }
    if (Number(c.vida) > 0 || Number(c.pvMax) > 0) score += 20;
    if (Number(c.peMax) > 0) score += 10;
    if (c.raca || c.classe) score += 20;
    if (c.historia || c.aparencia || c.anotacoes) score += 15;
    if (c.imagem) score += 60;
    if (Array.isArray(c.imagens) && c.imagens.length > 0) score += 40;
    return score;
  };

  const addCharCandidate = (candidate: any) => {
    if (!candidate || typeof candidate !== 'object') return;
    
    // Suporte para quando 'data' vem empacotado como string JSON ou objeto
    let clean = candidate;
    if (typeof candidate.data === 'string') {
      try { clean = { ...JSON.parse(candidate.data), ...candidate, data: undefined }; } catch (e) { clean = candidate; }
    } else if (candidate.data && typeof candidate.data === 'object') {
      clean = { ...candidate.data, ...candidate };
    }

    // Suporte para tokens do VTT que encapsulam o personagem
    if (clean.character && typeof clean.character === 'object') {
      addCharCandidate(clean.character);
    }
    if (clean.sheet && typeof clean.sheet === 'object') {
      addCharCandidate(clean.sheet);
    }

    const id = clean.id || candidate.id || (clean.nome ? `recovered_${clean.nome.replace(/\s+/g, '_').toLowerCase()}` : null);
    if (!id || blacklist.has(id)) return;

    // Verificar se tem características mínimas de uma ficha de RPG deste sistema
    const isCharacter = 
      clean.nome !== undefined || 
      clean.atributos !== undefined || 
      clean.pvMax !== undefined || 
      clean.vida !== undefined ||
      clean.raca !== undefined ||
      clean.classe !== undefined ||
      Array.isArray(clean.armas) ||
      Array.isArray(clean.magias);

    if (!isCharacter) return;

    const currentScore = calculateRichness(clean);
    const existing = foundMap.get(id);

    if (!existing || currentScore > calculateRichness(existing)) {
      foundMap.set(id, { ...clean, id });
    }
  };

  if (typeof localStorage === 'undefined') return [];

  // 1. Chave principal padrão
  try {
    const mainSaved = localStorage.getItem('rpg_system_x_chars');
    if (mainSaved) {
      const parsed = JSON.parse(mainSaved);
      if (Array.isArray(parsed?.characters)) parsed.characters.forEach(addCharCandidate);
      else if (Array.isArray(parsed)) parsed.forEach(addCharCandidate);
    }
  } catch (e) {}

  // 2. Tabela Supabase local de characters
  try {
    const tableSaved = localStorage.getItem('supabase_table_characters');
    if (tableSaved) {
      const parsed = JSON.parse(tableSaved);
      if (Array.isArray(parsed)) parsed.forEach(addCharCandidate);
    }
  } catch (e) {}

  // 3. Backup de histórico dedicado (cofre imutável)
  try {
    const histSaved = localStorage.getItem('rpg_chars_history_backup');
    if (histSaved) {
      const parsed = JSON.parse(histSaved);
      if (Array.isArray(parsed)) parsed.forEach(addCharCandidate);
    }
  } catch (e) {}

  // 4. Varredura profunda em TODAS as chaves de localStorage sem exceção
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      try {
        const val = localStorage.getItem(key);
        if (!val || val.length < 10) continue;
        
        // Tenta fazer parse se for JSON
        if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item && typeof item === 'object') addCharCandidate(item);
            });
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.characters)) {
              parsed.characters.forEach(addCharCandidate);
            }
            if (Array.isArray(parsed.fichas)) {
              parsed.fichas.forEach(addCharCandidate);
            }
            if (Array.isArray(parsed.players)) {
              parsed.players.forEach(addCharCandidate);
            }
            // Objeto ficha avulso
            if (parsed.nome || parsed.atributos || parsed.pvMax || parsed.raca) {
              addCharCandidate(parsed);
            }
          }
        }
      } catch (e) {
        // Ignora valores que não são JSON
      }
    }
  } catch (e) {}

  const result = Array.from(foundMap.values());

  // Salvar no cofre de histórico para garantir que nunca mais se percam
  if (result.length > 0) {
    try {
      safeLocalStorageSetItem('rpg_chars_history_backup', JSON.stringify(result));
    } catch (e) {}
  }

  console.log(`🛡️ [Rescue] Encontradas ${result.length} fichas salvas no armazenamento local.`);
  return result;
};

export const rescueAllLocalCampaigns = (): any[] => {
  const found: any[] = [];
  const seenIds = new Set<string>();

  const addCamp = (c: any) => {
    if (!c || typeof c !== 'object') return;
    const clean = c.data || c;
    const id = clean.id || c.id;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      found.push({ ...clean, id });
    }
  };

  if (typeof localStorage === 'undefined') return found;

  try {
    const tableSaved = localStorage.getItem('supabase_table_campaigns');
    if (tableSaved) {
      const parsed = JSON.parse(tableSaved);
      if (Array.isArray(parsed)) parsed.forEach(addCamp);
    }
  } catch (e) {}

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.includes('campaign') && !key.startsWith('campaign_characters_')) {
      try {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) parsed.forEach(addCamp);
          else if (parsed && typeof parsed === 'object' && (parsed.name || parsed.id)) addCamp(parsed);
        }
      } catch (e) {}
    }
  }

  return found;
};

// Memory Cache to speed up repeat reads
export const collectionMemoryCache: { [collectionName: string]: any[] } = {};

// Clean undefined fields to avoid DB write exceptions
export function removeUndefinedFields(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields);
  }
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = removeUndefinedFields(val);
    }
  }
  return clean;
}

// Direct local storage emulator for tables when offline/not configured
function getLocalTable(table: string): any[] {
  try {
    const data = safeLocalStorageGetItem(`supabase_table_${table}`) || localStorage.getItem(`supabase_table_${table}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalTable(table: string, data: any[], skipDispatch = false) {
  try {
    const serialized = JSON.stringify(data);
    const existing = safeLocalStorageGetItem(`supabase_table_${table}`);
    if (existing === serialized) {
      return;
    }
    safeLocalStorageSetItem(`supabase_table_${table}`, serialized);
    if (!skipDispatch) {
      // Trigger any local change listeners
      window.dispatchEvent(new CustomEvent(`supabase_local_change_${table}`));
    }
  } catch (e) {
    console.warn(`Error saving local table ${table}:`, e);
  }
}

// Helper to wrap promises with a timeout to avoid hanging UI
function withTimeout(promise: any, ms: number = 2000): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout de conexão com o banco de dados."));
    }, ms);
    promise.then(
      (res: any) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err: any) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Universal entity field getter with snake_case and camelCase support across top-level and inner data
export function getEntityValue(row: any, field: string): any {
  if (!row) return undefined;
  if (row[field] !== undefined) return row[field];
  const camelField = field.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
  if (row[camelField] !== undefined) return row[camelField];
  const snakeField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  if (row[snakeField] !== undefined) return row[snakeField];
  if (row.data && typeof row.data === 'object') {
    if (row.data[field] !== undefined) return row.data[field];
    if (row.data[camelField] !== undefined) return row.data[camelField];
    if (row.data[snakeField] !== undefined) return row.data[snakeField];
  }
  return undefined;
}

// Case-insensitive comparator for email fields and robust value matching
export function matchesFieldValue(valA: any, valB: any, fieldName: string): boolean {
  if (valA === undefined || valB === undefined || valA === null || valB === null) return false;
  if (fieldName.toLowerCase().includes('email')) {
    return String(valA).trim().toLowerCase() === String(valB).trim().toLowerCase();
  }
  return String(valA).trim() === String(valB).trim();
}

// Query builder mapping Supabase JS API to either cloud Supabase or local storage emulator
class ResilientQueryBuilder {
  private table: string;
  private filters: { column: string; operator: string; value: any }[] = [];
  private orFilters: string[] = [];
  private orderField: string | null = null;
  private orderAscending: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns?: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: '==', value });
    return this;
  }

  in(column: string, values: any[]) {
    if (values && values.length > 0) {
      this.filters.push({ column, operator: 'in', value: values });
    } else {
      this.filters.push({ column, operator: '==', value: '__non_existent_id__' });
    }
    return this;
  }

  or(queryString: string) {
    this.orFilters.push(queryString);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async insert(values: any) {
    const items = Array.isArray(values) ? values : [values];
    
    // Invalidate caches
    delete collectionMemoryCache[this.table];

    if (realSupabaseClient) {
      try {
        const { data, error, status } = (await withTimeout(
          realSupabaseClient.from(this.table).upsert(values),
          2000
        )) as any;
        if (error) {
          checkSupabaseError(error, status);
        }
        if (!error) {
          // Mirror to local table for offline robustness
          const local = getLocalTable(this.table);
          for (const item of items) {
            const index = local.findIndex(x => x.id === item.id);
            if (index >= 0) local[index] = { ...local[index], ...item };
            else local.push(item);
          }
          saveLocalTable(this.table, local);
          setSupabaseConnectionState(true);
          return { data, error: null };
        }
        console.log(`[Supabase Offline-First] Write Error, using local storage:`, error);
        setSupabaseConnectionState(false);
      } catch (err) {
        console.log(`[Supabase Offline-First] Cloud Exception, using local storage:`, err);
        setSupabaseConnectionState(false);
      }
    }

    // Local Storage Fallback
    const local = getLocalTable(this.table);
    for (const item of items) {
      const cleanItem = removeUndefinedFields({ ...item });
      const index = local.findIndex(x => x.id === item.id);
      if (index >= 0) {
        local[index] = { ...local[index], ...cleanItem };
      } else {
        if (!cleanItem.id) {
          cleanItem.id = Math.random().toString(36).substr(2, 9);
        }
        local.push(cleanItem);
      }
    }
    saveLocalTable(this.table, local);
    return { data: values, error: null };
  }

  async upsert(values: any) {
    return this.insert(values);
  }

  update(values: any) {
    // Invalidate caches
    delete collectionMemoryCache[this.table];

    const cleanValues = removeUndefinedFields(values);

    return {
      eq: (column: string, value: any) => {
        return {
          then: async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
            try {
              if (realSupabaseClient) {
                try {
                  const { data, error, status } = (await withTimeout(
                    realSupabaseClient
                      .from(this.table)
                      .update(cleanValues)
                      .eq(column, value),
                    2000
                  )) as any;
                  if (error) {
                    checkSupabaseError(error, status);
                  }
                  if (!error) {
                    // Mirror update locally
                    const local = getLocalTable(this.table);
                    const updatedLocal = local.map(item => {
                      if (String(item[column]) === String(value)) {
                        return { ...item, ...cleanValues };
                      }
                      return item;
                    });
                    saveLocalTable(this.table, updatedLocal);
                    setSupabaseConnectionState(true);
                    const res = { data, error: null };
                    return onfulfilled ? onfulfilled(res) : res;
                  }
                  console.log(`[Supabase Offline-First] Update Error, using local:`, error);
                  setSupabaseConnectionState(false);
                } catch (err) {
                  console.log(`[Supabase Offline-First] Update Exception, using local:`, err);
                  setSupabaseConnectionState(false);
                }
              }

              // Local Storage Update
              const local = getLocalTable(this.table);
              const updatedLocal = local.map(item => {
                if (String(item[column]) === String(value)) {
                  return { ...item, ...cleanValues };
                }
                return item;
              });
              saveLocalTable(this.table, updatedLocal);
              const res = { data: cleanValues, error: null };
              return onfulfilled ? onfulfilled(res) : res;
            } catch (err) {
              return onrejected ? onrejected(err) : Promise.reject(err);
            }
          }
        };
      }
    };
  }

  delete() {
    delete collectionMemoryCache[this.table];

    return {
      eq: (column: string, value: any) => {
        return {
          then: async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
            try {
              if (realSupabaseClient) {
                try {
                  const { data, error, status } = (await withTimeout(
                    realSupabaseClient
                      .from(this.table)
                      .delete()
                      .eq(column, value),
                    2000
                  )) as any;
                  if (error) {
                    checkSupabaseError(error, status);
                  }
                  if (!error) {
                    const local = getLocalTable(this.table);
                    const filtered = local.filter(item => {
                      if (!item) return false;
                      if (String(item[column]) === String(value)) return false;
                      if (item.data && String(item.data[column]) === String(value)) return false;
                      if (column === 'id' && item.data?.id && String(item.data.id) === String(value)) return false;
                      return true;
                    });
                    saveLocalTable(this.table, filtered);
                    setSupabaseConnectionState(true);
                    const res = { data, error: null };
                    return onfulfilled ? onfulfilled(res) : res;
                  }
                  setSupabaseConnectionState(false);
                } catch (err) {
                  console.log(`[Supabase Offline-First] Delete Exception, using local:`, err);
                  setSupabaseConnectionState(false);
                }
              }

              const local = getLocalTable(this.table);
              const filtered = local.filter(item => {
                if (!item) return false;
                if (String(item[column]) === String(value)) return false;
                if (item.data && String(item.data[column]) === String(value)) return false;
                if (column === 'id' && item.data?.id && String(item.data.id) === String(value)) return false;
                return true;
              });
              saveLocalTable(this.table, filtered);
              const res = { data: null, error: null };
              return onfulfilled ? onfulfilled(res) : res;
            } catch (err) {
              return onrejected ? onrejected(err) : Promise.reject(err);
            }
          }
        };
      }
    };
  }

  // Promise resolution method for querying
  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      let rows: any[] = [];
      let loadedFromCloud = false;

      if (realSupabaseClient) {
        try {
          let builder: any = realSupabaseClient.from(this.table).select('*');
          
          // Apply filters to cloud builder
          for (const f of this.filters) {
            if (f.operator === '==') {
              builder = builder.eq(f.column, f.value);
            } else if (f.operator === 'in') {
              builder = builder.in(f.column, f.value);
            }
          }
          for (const orFilter of this.orFilters) {
            builder = builder.or(orFilter);
          }
          if (this.orderField) {
            builder = builder.order(this.orderField, { ascending: this.orderAscending });
          }
          if (this.limitCount !== null) {
            builder = builder.limit(this.limitCount);
          }
          if (this.isSingle) {
            builder = builder.single();
          }

          let { data, error, status } = (await withTimeout(builder, 2000)) as any;
          if (error) {
            checkSupabaseError(error, status);
            setSupabaseConnectionState(false);
          }

          // If standard query failed or returned empty in local URL, try service_role admin client to bypass RLS
          if ((!data || (Array.isArray(data) && data.length === 0) || error) && isLocalUrl(currentConfig.url)) {
            try {
              const adminClient = createClient(currentConfig.url, LOCAL_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
              });
              let adminBuilder: any = adminClient.from(this.table).select('*');
              for (const f of this.filters) {
                if (f.operator === '==') adminBuilder = adminBuilder.eq(f.column, f.value);
                else if (f.operator === 'in') adminBuilder = adminBuilder.in(f.column, f.value);
              }
              for (const orFilter of this.orFilters) {
                adminBuilder = adminBuilder.or(orFilter);
              }
              if (this.orderField) {
                adminBuilder = adminBuilder.order(this.orderField, { ascending: this.orderAscending });
              }
              if (this.limitCount !== null) adminBuilder = adminBuilder.limit(this.limitCount);
              if (this.isSingle) adminBuilder = adminBuilder.single();

              const { data: adminData, error: adminErr } = (await withTimeout(adminBuilder, 2000)) as any;
              if (!adminErr && adminData && (!Array.isArray(adminData) || adminData.length > 0)) {
                data = adminData;
                error = null;
              }
            } catch (adminE) {}
          }

          if (!error && data) {
            setSupabaseConnectionState(true);
            rows = Array.isArray(data) ? data : [data];
            loadedFromCloud = true;
            
            // Sync with local memory and storage cache (non-destructive preservation)
            const local = getLocalTable(this.table);
            let filteredLocal = [...local];

            const cloudIds = new Set(rows.map(r => r.id));

            // Mark all rows returned from the cloud as remote synced
            for (const item of rows) {
              item.is_remote_synced = true;
              if (item.data) {
                item.data.isRemoteSynced = true;
              }
            }

            // Merge cloud data to local, overwriting older or duplicates
            for (const item of rows) {
              const idx = filteredLocal.findIndex(x => x.id === item.id);
              if (idx >= 0) filteredLocal[idx] = { ...filteredLocal[idx], ...item };
              else filteredLocal.push(item);
            }
            saveLocalTable(this.table, filteredLocal, true);

            // Temporarily include local-only items that match the filters but are not in the cloud yet
            const localOnly = filteredLocal.filter(l => {
              if (cloudIds.has(l.id)) return false;
              
              // Apply simple equality filter check
              for (const f of this.filters) {
                if (f.operator === '==') {
                  const val = getEntityValue(l, f.column);
                  if (!matchesFieldValue(val, f.value, f.column)) return false;
                }
              }

              // Apply OR filters if present
              for (const orStr of this.orFilters) {
                const parts = orStr.split(',');
                const matchesAny = parts.some(p => {
                  const segments = p.split('.');
                  if (segments.length >= 3) {
                    const col = segments[0];
                    const op = segments[1];
                    const val = segments.slice(2).join('.');
                    if (op === 'eq') {
                      const rowVal = getEntityValue(l, col);
                      return matchesFieldValue(rowVal, val, col);
                    }
                  }
                  return false;
                });
                if (!matchesAny) return false;
              }

              return true;
            });

            if (localOnly.length > 0) {
              rows = [...rows, ...localOnly];
            }
          }
        } catch (err: any) {
          console.log(`[Supabase Offline-First] Read Exception, using local fallback:`, err.message || err);
          setSupabaseConnectionState(false);
        }
      }

      if (!loadedFromCloud) {
        // Load offline fallback
        rows = getLocalTable(this.table);

        // Apply filters in memory
        for (const f of this.filters) {
          if (f.operator === '==') {
            rows = rows.filter(r => {
              const val = getEntityValue(r, f.column);
              return matchesFieldValue(val, f.value, f.column);
            });
          } else if (f.operator === 'in') {
            rows = rows.filter(r => {
              const val = getEntityValue(r, f.column);
              return Array.isArray(f.value) && f.value.map(String).includes(String(val));
            });
          }
        }

        for (const orStr of this.orFilters) {
          // E.g. "user_id.eq.foo,user_email.eq.bar"
          const parts = orStr.split(',');
          rows = rows.filter(row => {
            return parts.some(p => {
              const segments = p.split('.');
              if (segments.length >= 3) {
                const col = segments[0];
                const op = segments[1];
                const val = segments.slice(2).join('.');
                if (op === 'eq') {
                  const rowVal = getEntityValue(row, col);
                  return matchesFieldValue(rowVal, val, col);
                }
              }
              return false;
            });
          });
        }

        // Apply ordering
        if (this.orderField) {
          const col = this.orderField;
          const asc = this.orderAscending;
          rows.sort((a, b) => {
            let valA = a[col] !== undefined ? a[col] : '';
            let valB = b[col] !== undefined ? b[col] : '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
          });
        }

        // Apply limit
        if (this.isSingle) {
          rows = rows.slice(0, 1);
        } else if (this.limitCount !== null) {
          rows = rows.slice(0, this.limitCount);
        }
      }

      const result = this.isSingle 
        ? { data: rows.length > 0 ? rows[0] : null, error: null }
        : { data: rows, error: null };

      return onfulfilled ? onfulfilled(result) : result;
    } catch (err) {
      return onrejected ? onrejected(err) : Promise.reject(err);
    }
  }
}

// Authentication coordinator using direct Supabase Auth with standard localStorage guest session state
let currentAuthUser: any = null;

// Synchronously restore previous session or initialize offline user
const savedUser = localStorage.getItem('supabase_auth_user');
if (savedUser) {
  try {
    currentAuthUser = JSON.parse(savedUser);
  } catch (e) {}
}

// Check if this window is a popup opened for OAuth authentication
const isPopupAuth = typeof window !== 'undefined' && 
  window.self === window.top && 
  (window.name === 'supabase_oauth_popup' || (window.opener && window.opener !== window));

// Helper function to notify opener or parent window that login was successful
const notifyAuthSuccess = (session: any) => {
  if (typeof window === 'undefined' || !session) return;
  console.log("⚡ [Popup Auth] Notifying auth success with session...");
  
  const userEmail = (session.user?.email || "").trim().toLowerCase();
  const userObj = {
    uid: session.user?.id || "",
    email: userEmail,
    displayName: session.user?.user_metadata?.full_name || session.user?.email || "",
  };

  if (userEmail && session.user?.id) {
    try {
      localStorage.setItem('account_google_uid_' + userEmail, session.user.id);
    } catch (e) {}
  }

  const authData = {
    user: userObj,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }
  };

  // 1. Set localStorage signal (works perfectly across iframe/tab boundaries of the same origin)
  try {
    localStorage.setItem('supabase_auth_success_signal', JSON.stringify({ ...authData, timestamp: Date.now() }));
  } catch (err) {
    console.error("⚡ [Popup Auth] Error writing to localStorage signal:", err);
  }

  // 2. PostMessage to opener as backup
  if (window.opener) {
    try {
      window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS', ...authData }, '*');
    } catch (err) {
      console.error("⚡ [Popup Auth] Error posting message:", err);
    }
  }

  // Close popup after a short delay
  setTimeout(() => {
    try {
      window.close();
    } catch (e) {}
  }, 1000);
};

let isSyncing = false;

export const isNetworkError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err.message || err.details || err.error_description || err || "").toLowerCase();
  const status = (err as any)?.status || (err as any)?.statusCode || (err as any)?.code;
  
  if (
    status === 502 || 
    status === 503 || 
    status === 504 || 
    status === '502' || 
    status === '503' || 
    status === '504' || 
    status === 'PGRST_CONNECTION_REFUSED' ||
    status === 'ECONNREFUSED' ||
    status === 'ENOTFOUND'
  ) {
    return true;
  }

  return (
    msg.includes('failed to fetch') ||
    msg.includes('typeerror') ||
    msg.includes('networkerror') ||
    msg.includes('cors') ||
    msg.includes('aborterror') ||
    msg.includes('timeout') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('net::err_') ||
    msg.includes('<!doctype') ||
    msg.includes('<html') ||
    msg.includes('<head') ||
    msg.includes('<title>') ||
    msg.includes('starting server') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('service unavailable') ||
    msg.includes('supabase local indisponível') ||
    msg.includes('supabase proxy error') ||
    msg.includes('load failed')
  );
};

export const forceSyncAndRestoreByEmail = async (
  userEmail?: string,
  userId?: string
): Promise<{ 
  characters: any[]; 
  campaigns: any[]; 
  count: number; 
  fromCloud: number; 
  fromLocal: number; 
  remoteError: string | null;
}> => {
  const activeEmail = (userEmail || currentAuthUser?.email || "").trim().toLowerCase();
  const activeUserId = userId || currentAuthUser?.uid || "";

  console.log(`⚡ [ForceSync] Iniciando varredura completa (Nuvem Local + Cache Local) para e-mail: "${activeEmail}" (UID: "${activeUserId}")`);

  const restoredCharacters: any[] = [];
  const restoredCampaigns: any[] = [];
  const seenCharIds = new Set<string>();
  const seenCampIds = new Set<string>();

  let countCloud = 0;
  let countLocal = 0;
  let remoteError: string | null = null;

  const isLocalUrl = (url: string) => {
    const u = (url || '').toLowerCase();
    return u.includes('127.0.0.1') || u.includes('localhost') || u.includes('::1') || u.includes('0.0.0.0');
  };

  const LOCAL_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM7JyUXp7fZ83VvlN-BRwsPIgtcqbyUTR21s-TqF4";

  // 1. TENTAR BUSCA NA TABELA 'characters' DO SUPABASE (COM CLIENTE ATUAL OU FALLBACK SERVICE ROLE)
  if (realSupabaseClient) {
    try {
      let remoteChars: any[] | null = null;
      
      // Tentativa 1: Cliente Supabase padrão
      const { data: standardData, error: standardErr } = await realSupabaseClient
        .from('characters')
        .select('*');

      if (standardErr) {
        console.warn("⚠️ [ForceSync] Consulta padrão retornou aviso:", standardErr.message || standardErr);
        remoteError = standardErr.message || String(standardErr);
      } else if (Array.isArray(standardData)) {
        remoteChars = standardData;
      }

      // Tentativa 2: Se deu erro de permissão (ex: permission denied) ou retornou vazio e estamos em URL local/custom, tentar chave administrativa (service_role)
      if ((!remoteChars || remoteChars.length === 0 || standardErr) && isLocalUrl(currentConfig.url)) {
        try {
          const adminClient = createClient(currentConfig.url, LOCAL_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          });
          const { data: adminData, error: adminErr } = await adminClient.from('characters').select('*');
          if (!adminErr && Array.isArray(adminData) && adminData.length > 0) {
            console.log(`🔑 [ForceSync] Recuperadas ${adminData.length} fichas via chave administrativa local (RLS contornado)!`);
            remoteChars = adminData;
            remoteError = null;
          } else if (adminErr) {
            console.warn("⚠️ [ForceSync] Tentativa com service_role também retornou erro:", adminErr.message || adminErr);
          }
        } catch (adminTryErr) {
          console.warn("⚠️ [ForceSync] Erro ao instanciar cliente admin:", adminTryErr);
        }
      }

      const deletedBlacklist: Set<string> = (() => {
        try {
          const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('deleted_characters_blacklist') || localStorage.getItem('demons_despair_deleted_chars')) : null;
          return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch (e) {
          return new Set();
        }
      })();

      if (remoteChars && Array.isArray(remoteChars) && remoteChars.length > 0) {
        console.log(`📋 [ForceSync] ${remoteChars.length} registro(s) encontrado(s) na tabela 'characters' do Supabase.`);
        const charsToUpdateInCloud: any[] = [];

        for (const row of remoteChars) {
          let charData: any = {};
          if (typeof row.data === 'string') {
            try { charData = JSON.parse(row.data); } catch (e) { charData = {}; }
          } else if (row.data && typeof row.data === 'object') {
            charData = { ...row.data };
          }

          const charId = row.id || charData.id;
          if (!charId || deletedBlacklist.has(charId)) {
            // Se a ficha foi deletada pelo usuário mas ainda existe no banco remoto, limpa do servidor
            if (charId && deletedBlacklist.has(charId) && realSupabaseClient) {
              Promise.resolve(realSupabaseClient.from('characters').delete().eq('id', charId)).catch(() => {});
            }
            continue;
          }

          const candidateName = charData.nome || row.nome || row.name || '';
          const rowEmail = (row.user_email || charData.userEmail || charData.user_email || '').trim().toLowerCase();

          // Critério estrito email-first:
          const isMatchEmail = Boolean(activeEmail && rowEmail && rowEmail === activeEmail);

          if (isMatchEmail) {
            if (!seenCharIds.has(charId)) {
              seenCharIds.add(charId);

              const sanitizedChar = {
                ...row,
                ...charData,
                id: charId,
                nome: candidateName || "Personagem",
                userId: activeUserId || activeEmail,
                userEmail: activeEmail,
                isRemoteSynced: true
              };

              restoredCharacters.push(sanitizedChar);
              countCloud++;
            }
          }
        }
      }
    } catch (e: any) {
      console.warn("⚠️ [ForceSync] Erro ao consultar 'characters' no Supabase:", e);
      remoteError = e.message || String(e);
    }
  }

  // 2. TENTAR BUSCA NA TABELA 'campaigns' DO SUPABASE
  if (realSupabaseClient) {
    try {
      let remoteCamps: any[] | null = null;
      const { data: campData, error: campErr } = await realSupabaseClient.from('campaigns').select('*');
      if (!campErr && Array.isArray(campData)) {
        remoteCamps = campData;
      }

      if ((!remoteCamps || remoteCamps.length === 0 || campErr) && isLocalUrl(currentConfig.url)) {
        try {
          const adminClient = createClient(currentConfig.url, LOCAL_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          });
          const { data: adminCamps } = await adminClient.from('campaigns').select('*');
          if (Array.isArray(adminCamps) && adminCamps.length > 0) remoteCamps = adminCamps;
        } catch (e) {}
      }

      if (remoteCamps && Array.isArray(remoteCamps)) {
        for (const row of remoteCamps) {
          let cData: any = {};
          if (typeof row.data === 'string') {
            try { cData = JSON.parse(row.data); } catch (e) { cData = {}; }
          } else if (row.data && typeof row.data === 'object') {
            cData = { ...row.data };
          }

          const campName = row.name || cData.name || "Campanha";
          const rowMasterEmail = (row.master_email || cData.masterEmail || cData.master_email || '').trim().toLowerCase();
          const origEmail = (cData.masterEmail || cData.master_email || '').trim().toLowerCase();

          // Critério estrito email-first:
          const isMatchEmail = Boolean(activeEmail && ((rowMasterEmail && rowMasterEmail === activeEmail) || (origEmail && origEmail === activeEmail)));

          if (isMatchEmail) {
            const campId = row.id || cData.id;
            if (campId && !seenCampIds.has(campId)) {
              seenCampIds.add(campId);
              let playerEmails = cData.playerEmails || row.player_emails || [activeEmail];
              if (!Array.isArray(playerEmails)) playerEmails = [activeEmail];
              playerEmails = playerEmails.map((e: string) => (e || '').toLowerCase());
              if (!playerEmails.includes(activeEmail)) playerEmails.push(activeEmail);

              const sanitizedCamp = {
                ...row,
                ...cData,
                id: campId,
                name: campName,
                masterId: activeUserId || activeEmail,
                masterEmail: activeEmail,
                playerEmails,
                inviteCode: row.invite_code || cData.inviteCode || ""
              };
              restoredCampaigns.push(sanitizedCamp);
            }
          }
        }
      }
    } catch (e) {}
  }

  // 3. BUSCA E RESGATE NO CACHE DO NAVEGADOR (LOCALSTORAGE) COM ISOLAMENTO POR EMAIL
  try {
    const deletedBlacklist: Set<string> = (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('deleted_characters_blacklist') || localStorage.getItem('demons_despair_deleted_chars')) : null;
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) {
        return new Set();
      }
    })();

    const localRescuedChars = rescueAllLocalCharacters();
    if (localRescuedChars.length > 0) {
      for (const locChar of localRescuedChars) {
        const charId = locChar.id;
        if (!charId || deletedBlacklist.has(charId)) continue;

        const locEmail = (locChar.userEmail || locChar.user_email || locChar.email || '').trim().toLowerCase();
        const isOwnChar = Boolean(locEmail && activeEmail && locEmail === activeEmail);

        if (isOwnChar) {
          if (!seenCharIds.has(charId)) {
            seenCharIds.add(charId);
            const sanitized = {
              ...locChar,
              id: charId,
              userId: activeUserId || activeEmail,
              userEmail: activeEmail
            };
            restoredCharacters.push(sanitized);
            countLocal++;
          }
        }
      }
    }

    const localRescuedCamps = rescueAllLocalCampaigns();
    if (localRescuedCamps.length > 0) {
      for (const locCamp of localRescuedCamps) {
        const campId = locCamp.id;
        const locMasterEmail = (locCamp.masterEmail || locCamp.master_email || '').trim().toLowerCase();
        const isOwnCamp = Boolean(locMasterEmail && activeEmail && locMasterEmail === activeEmail);

        if (isOwnCamp) {
          if (campId && !seenCampIds.has(campId)) {
            seenCampIds.add(campId);
            const sanitized = {
              ...locCamp,
              id: campId,
              masterId: activeUserId || activeEmail,
              masterEmail: activeEmail
            };
            restoredCampaigns.push(sanitized);
          }
        }
      }
    }
  } catch (locErr) {
    console.warn("⚠️ [ForceSync] Erro ao resgatar dados locais:", locErr);
  }

  // 4. PERSISTIR TUDO NOS ARMAZENAMENTOS LOCAIS PRESERVANDO DADOS DE OUTRAS CONTAS
  if (restoredCharacters.length > 0) {
    const currentLocalChars = getLocalTable('characters');
    const mergedChars = currentLocalChars.filter(c => {
      const cEmail = (c.user_email || c.data?.userEmail || '').trim().toLowerCase();
      const cUid = c.user_id || c.data?.userId;
      // Preservar fichas de outros usuários na tabela local
      return (cEmail && activeEmail && cEmail !== activeEmail) && (cUid && activeUserId && cUid !== activeUserId);
    });

    for (const rc of restoredCharacters) {
      mergedChars.push({
        id: rc.id,
        user_id: rc.userId || activeUserId,
        user_email: rc.userEmail || activeEmail,
        campaign_id: rc.campaignId || null,
        data: rc,
        updated_at: new Date().toISOString()
      });
    }
    saveLocalTable('characters', mergedChars, true);

    try {
      const mainSaved = localStorage.getItem('rpg_system_x_chars');
      let currentParsed: any = {};
      if (mainSaved) {
        try { currentParsed = JSON.parse(mainSaved); } catch (e) {}
      }
      const existingList = Array.isArray(currentParsed?.characters) ? currentParsed.characters : [];
      const mergedMain = [...restoredCharacters];
      for (const ex of existingList) {
        const exEmail = (ex.userEmail || '').trim().toLowerCase();
        if (exEmail && activeEmail && exEmail !== activeEmail) {
          // Manter fichas de outros usuários
          mergedMain.push(ex);
        } else if (!mergedMain.some(m => m.id === ex.id) && ex.nome && ex.nome !== 'Novo Personagem') {
          mergedMain.push(ex);
        }
      }
      currentParsed.characters = mergedMain;
      if (!currentParsed.activeCharacterId && mergedMain.length > 0) {
        currentParsed.activeCharacterId = mergedMain[0].id;
      }
      localStorage.setItem('rpg_system_x_chars', JSON.stringify(currentParsed));
    } catch (e) {}
  }

  if (restoredCampaigns.length > 0) {
    const currentLocalCamps = getLocalTable('campaigns');
    const mergedCamps = currentLocalCamps.filter(c => {
      const cEmail = (c.master_email || c.data?.masterEmail || '').trim().toLowerCase();
      const cUid = c.master_id || c.data?.masterId;
      // Preservar campanhas de outros mestres
      return (cEmail && activeEmail && cEmail !== activeEmail) && (cUid && activeUserId && cUid !== activeUserId);
    });

    for (const rCamp of restoredCampaigns) {
      mergedCamps.push({
        id: rCamp.id,
        master_id: rCamp.masterId || activeUserId,
        master_email: rCamp.masterEmail || activeEmail,
        name: rCamp.name,
        invite_code: rCamp.inviteCode,
        data: rCamp,
        updated_at: new Date().toISOString()
      });
    }
    saveLocalTable('campaigns', mergedCamps, true);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('supabase_local_change_characters'));
    window.dispatchEvent(new Event('supabase_local_change_campaigns'));
    window.dispatchEvent(new CustomEvent('campaigns_updated', { detail: { campaigns: restoredCampaigns } }));
  }

  console.log(`✅ [ForceSync] Concluído: ${restoredCharacters.length} ficha(s) (Nuvem: ${countCloud}, Local: ${countLocal}), ${restoredCampaigns.length} campanha(s).`);

  return {
    characters: restoredCharacters,
    campaigns: restoredCampaigns,
    count: restoredCharacters.length,
    fromCloud: countCloud,
    fromLocal: countLocal,
    remoteError
  };
};

export const syncLocalToCloud = async () => {
  if (isSyncing || !realSupabaseClient || !currentAuthUser) return;
  
  if (currentAuthUser.uid && currentAuthUser.uid.startsWith('guest_')) {
    console.log("⚡ [Sync] Active user is guest, skipping cloud upload.");
    return;
  }

  isSyncing = true;
  console.log("⚡ [Sync] Starting offline to online synchronization...");
  let anyUploadError = false;

  try {
    const userId = currentAuthUser.uid;
    const userEmail = (currentAuthUser.email || "").trim().toLowerCase();

    // 1. Sync Characters
    const deletedBlacklist: Set<string> = (() => {
      try {
        const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('deleted_characters_blacklist') || localStorage.getItem('demons_despair_deleted_chars')) : null;
        return raw ? new Set(JSON.parse(raw)) : new Set();
      } catch (e) {
        return new Set();
      }
    })();

    let localCharacters = getLocalTable('characters').filter(c => c && c.id && !deletedBlacklist.has(c.id));

    const hasRealLocalChars = localCharacters.some(c => {
      const cEmail = (c.user_email || c.data?.userEmail || '').trim().toLowerCase();
      const isMine = cEmail && userEmail && cEmail === userEmail;
      return isMine && (c.data?.nome || c.nome) && (c.data?.nome || c.nome) !== 'Novo Personagem';
    });

    if (!hasRealLocalChars && typeof localStorage !== 'undefined') {
      const rescued = rescueAllLocalCharacters();
      const userRescued = rescued.filter((c: any) => {
        if (!c || !c.id || deletedBlacklist.has(c.id)) return false;
        const cEmail = (c.userEmail || c.user_email || c.email || '').trim().toLowerCase();
        return Boolean(cEmail && userEmail && cEmail === userEmail);
      });

      if (userRescued.length > 0) {
        console.log(`⚡ [Sync] Resgatadas ${userRescued.length} fichas locais do usuário para sincronização!`);
        const newLocal = userRescued.map((c: any) => ({
          id: c.id,
          user_id: userId || userEmail,
          user_email: userEmail,
          campaign_id: c.campaignId || null,
          data: { ...c, userEmail },
          updated_at: new Date().toISOString()
        }));
        // Merge with existing local characters from other accounts
        const preservedOtherChars = localCharacters.filter(c => {
          const cEmail = (c.user_email || c.data?.userEmail || '').trim().toLowerCase();
          return cEmail && userEmail && cEmail !== userEmail;
        });
        localCharacters = [...preservedOtherChars, ...newLocal];
        saveLocalTable('characters', localCharacters, true);
      }
    }

    if (localCharacters.length > 0) {
      const charactersToUpload = [];
      const updatedLocalCharacters = [];

      for (const item of localCharacters) {
        if (!item || !item.id || deletedBlacklist.has(item.id)) continue;
        const charData = item.data || item;
        const itemEmail = (item.user_email || charData.userEmail || '').trim().toLowerCase();

        const isSameEmail = Boolean(itemEmail && userEmail && itemEmail === userEmail);

        if (isSameEmail) {
          item.user_id = userId || userEmail;
          item.user_email = userEmail;
          if (item.data) {
            item.data.userId = userId || userEmail;
            item.data.userEmail = userEmail;
          }
          charactersToUpload.push(item);
        }
        updatedLocalCharacters.push(item);
      }

      for (const item of charactersToUpload) {
        try {
          const charData = item.data || item;
          console.log(`⚡ [Sync] Uploading character ${charData.nome || item.id} to cloud...`);
          
          item.is_remote_synced = true;
          if (item.data) {
            item.data.isRemoteSynced = true;
          }

          let { error, status } = await realSupabaseClient.from('characters').upsert({
            id: item.id,
            user_id: item.user_id,
            user_email: item.user_email,
            campaign_id: item.campaign_id || charData.campaignId || null,
            data: charData,
            updated_at: new Date().toISOString()
          }) as any;

          if (error && (status === 401 || status === 403 || error.code === '42501' || String(error.message).includes('permission')) && isLocalUrl(currentConfig.url)) {
            try {
              const { createClient } = await import('@supabase/supabase-js');
              const adminClient = createClient(currentConfig.url, STANDARD_LOCAL_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'supabase_admin_temp_upsert' }
              });
              const { error: adminErr } = await adminClient.from('characters').upsert({
                id: item.id,
                user_id: item.user_id,
                user_email: item.user_email,
                campaign_id: item.campaign_id || charData.campaignId || null,
                data: charData,
                updated_at: new Date().toISOString()
              });
              if (!adminErr) {
                error = null;
                item.is_remote_synced = true;
                if (item.data) {
                  item.data.isRemoteSynced = true;
                }
              }
            } catch (e) {}
          }
          if (error) {
            anyUploadError = true;
            item.is_remote_synced = false;
            if (item.data) {
              item.data.isRemoteSynced = false;
            }
            if (isNetworkError(error)) {
              console.warn(`⚠️ [Sync] Network issue uploading character ${item.id} (${charData.nome}) to cloud:`, error.message || error);
            } else {
              console.error(`❌ [Sync] Error uploading character ${item.id} (${charData.nome}) to cloud:`, error);
            }
            checkSupabaseError(error, status);
          }
        } catch (uploadErr) {
          anyUploadError = true;
          item.is_remote_synced = false;
          if (item.data) {
            item.data.isRemoteSynced = false;
          }
          if (isNetworkError(uploadErr)) {
            console.warn(`⚠️ [Sync] Network exception uploading character ${item.id} (remaining offline):`, uploadErr);
          } else {
            console.error(`❌ [Sync] Exception uploading character ${item.id}:`, uploadErr);
          }
          checkSupabaseError(uploadErr, (uploadErr as any)?.status);
        }
      }

      saveLocalTable('characters', updatedLocalCharacters, true);
    }

    // 2. Sync Campaigns
    const localCampaigns = getLocalTable('campaigns');
    if (localCampaigns.length > 0) {
      console.log(`⚡ [Sync] Found ${localCampaigns.length} local campaigns. Verifying alignment...`);
      
      const campaignsToUpload = [];
      const updatedLocalCampaigns = [];

      for (const item of localCampaigns) {
        const campData = item.data || item;
        const itemEmail = (item.master_email || campData.masterEmail || '').trim().toLowerCase();

        const isSameEmail = Boolean(itemEmail && userEmail && itemEmail === userEmail);

        if (isSameEmail) {
          item.master_id = userId || userEmail;
          item.master_email = userEmail;
          if (item.data) {
            item.data.masterId = userId || userEmail;
            item.data.masterEmail = userEmail;
          }
          campaignsToUpload.push(item);
        }
        updatedLocalCampaigns.push(item);
      }

      saveLocalTable('campaigns', updatedLocalCampaigns, true);

      for (const item of campaignsToUpload) {
        try {
          const campData = item.data || item;
          console.log(`⚡ [Sync] Uploading campaign ${item.name || item.id} to cloud...`);
          
          const { error, status } = await realSupabaseClient.from('campaigns').upsert({
            id: item.id,
            master_id: item.master_id,
            master_email: item.master_email,
            name: item.name || campData.name || "Sem Nome",
            invite_code: item.invite_code || campData.inviteCode || "",
            data: campData,
            updated_at: new Date().toISOString()
          }) as any;
          if (error) {
            anyUploadError = true;
            if (isNetworkError(error)) {
              console.warn(`⚠️ [Sync] Network issue uploading campaign ${item.id} (${item.name || "Sem Nome"}) to cloud:`, error.message || error);
            } else {
              console.error(`❌ [Sync] Error uploading campaign ${item.id} (${item.name || "Sem Nome"}) to cloud:`, error);
            }
            checkSupabaseError(error, status);
          }
        } catch (uploadErr) {
          anyUploadError = true;
          if (isNetworkError(uploadErr)) {
            console.warn(`⚠️ [Sync] Network exception uploading campaign ${item.id} (remaining offline):`, uploadErr);
          } else {
            console.error(`❌ [Sync] Exception uploading campaign ${item.id}:`, uploadErr);
          }
          checkSupabaseError(uploadErr, (uploadErr as any)?.status);
        }
      }
    }

    if (anyUploadError) {
      console.warn("⚠️ [Sync] Synchronization complete with some errors. Retaining CACHE_ONLY status.");
      setSupabaseConnectionState(false);
    } else {
      console.log("⚡ [Sync] Synchronization complete! All data pushed successfully.");
      setSupabaseConnectionState(true);
    }
    window.dispatchEvent(new Event('supabase_local_change_characters'));
    window.dispatchEvent(new Event('supabase_local_change_campaigns'));
  } catch (err) {
    setSupabaseConnectionState(false);
    if (isNetworkError(err)) {
      console.warn("⚠️ [Sync] Network issue during synchronization (remaining offline):", err);
    } else {
      console.error("⚡ [Sync] Exception during synchronization:", err);
    }
  } finally {
    isSyncing = false;
  }
};

// Auto sync on module load if logged in
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncLocalToCloud().catch(err => {
      if (isNetworkError(err)) {
        console.warn("⚠️ [Sync] Network issue in auto syncLocalToCloud (remaining offline):", err);
      } else {
        console.error("Error in auto syncLocalToCloud:", err);
      }
    });
  }, 2000);

  // Monitor continuous connection to local Supabase periodically
  setInterval(async () => {
    if (currentAuthUser && !currentAuthUser.uid.startsWith('guest_')) {
      try {
        const check = await testSupabaseConnection();
        setSupabaseConnectionState(check.success);
      } catch (e) {
        setSupabaseConnectionState(false);
      }
    }
  }, 10000);
}

if (realSupabaseClient) {
  try {
    realSupabaseClient.auth.getSession().then(({ data: { session } }) => {
      hasActiveRealSession = !!session;
      if (session?.user) {
        currentAuthUser = {
          uid: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || session.user.email,
        };
        localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
        
        if (isPopupAuth) {
          notifyAuthSuccess(session);
        } else {
          syncLocalToCloud().catch(() => {});
        }
      }
    }).catch((err) => {
      console.warn("⚠️ [Supabase] Failed to get session on startup:", err);
    });

    realSupabaseClient.auth.onAuthStateChange((event, session) => {
      hasActiveRealSession = !!session;
      if (session?.user) {
        const userEmail = (session.user.email || "").trim().toLowerCase();
        currentAuthUser = {
          uid: session.user.id,
          email: userEmail,
          displayName: session.user.user_metadata?.full_name || session.user.email,
        };
        localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
        if (userEmail && session.user.id) {
          try {
            localStorage.setItem('account_google_uid_' + userEmail, session.user.id);
          } catch (e) {}
        }
        
        if (isPopupAuth) {
          notifyAuthSuccess(session);
        } else {
          syncLocalToCloud().catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        currentAuthUser = null;
        localStorage.removeItem('supabase_auth_user');
      }
    });
  } catch (err) {
    console.error("⚠️ [Supabase] Auth listener initialization exception:", err);
  }
}

// If we are in the parent window (iframe or main tab), listen to the popup's message or storage signal
if (typeof window !== 'undefined' && !isPopupAuth) {
  // 1. PostMessage listener
  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'SUPABASE_AUTH_SUCCESS' && event.data?.user) {
      console.log("⚡ [Main Window] Received oauth login event from popup:", event.data.user);
      const user = event.data.user;
      const session = event.data.session;
      
      if (realSupabaseClient && session) {
        try {
          console.log("⚡ [Main Window] Setting Supabase session programmatically...");
          await realSupabaseClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          });
        } catch (err) {
          console.error("⚡ [Main Window] Error setting Supabase session:", err);
        }
      }
      
      currentAuthUser = user;
      localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
      window.dispatchEvent(new Event('supabase_auth_state_change_local'));
      window.location.reload();
    }
  });

  // 2. Storage event listener (resilient backup across identical origins)
  window.addEventListener('storage', async (event) => {
    if (event.key === 'supabase_auth_success_signal' && event.newValue) {
      try {
        const signal = JSON.parse(event.newValue);
        if (signal?.user) {
          console.log("⚡ [Main Window] Received oauth login event via localStorage signal:", signal.user);
          const user = signal.user;
          const session = signal.session;
          
          if (realSupabaseClient && session) {
            try {
              console.log("⚡ [Main Window] Setting Supabase session programmatically via storage signal...");
              await realSupabaseClient.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token
              });
            } catch (err) {
              console.error("⚡ [Main Window] Error setting Supabase session via storage signal:", err);
            }
          }
          
          currentAuthUser = user;
          localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
          localStorage.removeItem('supabase_auth_success_signal');
          window.dispatchEvent(new Event('supabase_auth_state_change_local'));
          window.location.reload();
        }
      } catch (err) {
        console.error("⚡ [Main Window] Error parsing storage signal:", err);
      }
    }
  });
}

// Core exported objects
export const supabase = {
  from: (table: string) => {
    return new ResilientQueryBuilder(table);
  },
  channel: (channelId: string) => {
    let realChan: any = null;
    if (realSupabaseClient) {
      try {
        const existing = (realSupabaseClient as any).getChannels?.() || [];
        const match = existing.find((c: any) => c.name === channelId || c.topic === channelId);
        if (match) {
          realSupabaseClient.removeChannel(match);
        }
      } catch (err) {
        console.warn("⚠️ [Supabase] Failed to remove existing channel before recreation:", err);
      }
      try {
        realChan = realSupabaseClient.channel(channelId);
      } catch (err) {
        console.warn("⚠️ [Supabase] Failed to create channel:", err);
      }
    }
    
    const chan = {
      on: (event: string, config: any, callback: () => void) => {
        // Setup local custom event listener
        const table = config?.table || 'campaigns';
        const listener = () => {
          callback();
        };
        if (typeof window !== 'undefined') {
          window.addEventListener(`supabase_local_change_${table}`, listener);
          const unsubKey = `chan_unsub_${channelId}_${table}`;
          (window as any)[unsubKey] = () => {
            window.removeEventListener(`supabase_local_change_${table}`, listener);
          };
        }
        if (realChan) {
          try {
            realChan.on(event, config, callback);
          } catch (err) {
            console.warn("⚠️ [Supabase] Failed to register on() callback on channel:", err);
          }
        }
        return chan;
      },
      subscribe: () => {
        let realSub: any = null;
        if (realChan) {
          try {
            realSub = realChan.subscribe();
          } catch (err) {
            console.warn("⚠️ [Supabase] Failed to subscribe to real-time channel:", err);
          }
        }
        return {
          unsubscribe: () => {
            if (realSub && typeof realSub.unsubscribe === 'function') {
              try {
                realSub.unsubscribe();
              } catch (err) {
                console.warn("⚠️ [Supabase] realSub unsubscribe failed:", err);
              }
            }
            if (realSupabaseClient && realChan) {
              try {
                realSupabaseClient.removeChannel(realChan);
              } catch (err) {
                console.warn("⚠️ [Supabase] Failed to remove real channel from client:", err);
              }
            }
            if (typeof window !== 'undefined') {
              Object.keys(window as any).forEach(key => {
                if (key.startsWith(`chan_unsub_${channelId}`)) {
                  const unsub = (window as any)[key];
                  if (typeof unsub === 'function') unsub();
                  delete (window as any)[key];
                }
              });
            }
          }
        };
      }
    };
    return chan as any;
  },
  removeChannel: (channel: any) => {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  }
};

export const auth = {
  get currentUser() {
    return currentAuthUser;
  },
  signOut: async () => {
    if (realSupabaseClient) {
      try {
        await realSupabaseClient.auth.signOut();
      } catch (err) {
        console.warn("⚠️ [Supabase] Sign out on cloud failed, clearing local state anyway:", err);
      }
    }

    // Salva cópia de segurança das fichas do usuário na chave da própria conta antes de deslogar
    if (currentAuthUser?.email) {
      try {
        const cleanEmail = currentAuthUser.email.trim().toLowerCase();
        const mainCharsRaw = localStorage.getItem('rpg_system_x_chars');
        if (mainCharsRaw) {
          const parsed = JSON.parse(mainCharsRaw);
          if (parsed && Array.isArray(parsed.characters)) {
            const userOnly = parsed.characters.filter((c: any) => {
              const cEmail = (c.userEmail || c.user_email || '').trim().toLowerCase();
              return cEmail === cleanEmail || c.userId === currentAuthUser.uid;
            });
            localStorage.setItem('rpg_chars_account_' + cleanEmail, JSON.stringify(userOnly));
          }
        }
      } catch (e) {}
    }

    currentAuthUser = null;
    localStorage.removeItem('supabase_auth_user');

    // Limpa da chave ativa 'rpg_system_x_chars' as fichas da conta registrada para que
    // um jogador que entre sem login NÃO veja as fichas da conta anterior!
    try {
      const mainCharsRaw = localStorage.getItem('rpg_system_x_chars');
      if (mainCharsRaw) {
        const parsed = JSON.parse(mainCharsRaw);
        if (parsed && Array.isArray(parsed.characters)) {
          const guestOnly = parsed.characters.filter((c: any) => {
            const cEmail = (c.userEmail || c.user_email || '').trim().toLowerCase();
            const cUid = c.userId || c.user_id || '';
            return (!cEmail || cEmail.startsWith('guest_')) && (!cUid || String(cUid).startsWith('guest_'));
          });
          const cleanState = {
            ...parsed,
            characters: guestOnly,
            activeCharacterId: guestOnly.length > 0 ? guestOnly[0].id : ''
          };
          localStorage.setItem('rpg_system_x_chars', JSON.stringify(cleanState));
        }
      }
    } catch (e) {}

    console.log("⚡ [Supabase Local] Sessão finalizada. Dados da conta preservados e sessão de convidado limpa.");

    window.location.reload();
  }
};

export const loginWithGoogle = async () => {
  if (realSupabaseClient) {
    console.log("⚡ [Supabase] Initiating OAuth signInWithOAuth via Google...");
    
    // Detect if we are inside an iframe
    const isIframe = window.self !== window.top;
    
    // In an iframe (like Google AI Studio), redirects are blocked. We must use a popup!
    const { data, error } = await realSupabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: isIframe
      }
    });
    if (error) throw error;
    
    if (isIframe && data?.url) {
      console.log("⚡ [Supabase] In-iframe mode detected: Opening OAuth in a popup window:", data.url);
      const width = 600;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.url,
        'supabase_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );
      
      if (!popup) {
        console.warn("⚠️ [Supabase] Popup blocked! Falling back to standard redirect.");
        window.location.href = data.url;
      }
    }
    
    return data;
  } else {
    // Generate an instant mock user for guest/preview convenience when url not provided
    console.log("⚡ [Supabase] Guest login generated instantly (no Supabase URL configured).");
    const mockUser = {
      uid: 'guest_user_' + Math.random().toString(36).substring(2, 11),
      email: '',
      displayName: 'Convidado (Offline)'
    };
    currentAuthUser = mockUser;
    localStorage.setItem('supabase_auth_user', JSON.stringify(mockUser));
    window.location.reload();
    return mockUser;
  }
};

export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
  const cleanEmail = email.trim();
  if (realSupabaseClient) {
    console.log("⚡ [Supabase] Initiating signUpWithEmail for:", cleanEmail);
    const { data, error } = await realSupabaseClient.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: displayName || cleanEmail.split('@')[0],
        }
      }
    });
    if (error) throw error;
    if (data.user) {
      const userObj = {
        uid: data.user.id,
        email: data.user.email || cleanEmail,
        displayName: data.user.user_metadata?.full_name || displayName || cleanEmail.split('@')[0],
      };
      if (data.session) {
        currentAuthUser = userObj;
        localStorage.setItem('supabase_auth_user', JSON.stringify(userObj));
        window.dispatchEvent(new Event('supabase_auth_state_change_local'));
        syncLocalToCloud().catch(() => {});
      }
      return { user: userObj, session: data.session, requiresConfirmation: !data.session };
    }
    return data;
  } else {
    console.log("⚡ [Supabase] Offline signUpWithEmail simulation for:", cleanEmail);
    const mockUser = {
      uid: 'user_' + Math.random().toString(36).substring(2, 11),
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0]
    };
    currentAuthUser = mockUser;
    localStorage.setItem('supabase_auth_user', JSON.stringify(mockUser));
    window.dispatchEvent(new Event('supabase_auth_state_change_local'));
    return { user: mockUser, session: null, requiresConfirmation: false };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  const cleanEmail = email.trim();
  if (realSupabaseClient) {
    console.log("⚡ [Supabase] Initiating signInWithPassword for:", cleanEmail);
    const { data, error } = await realSupabaseClient.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw error;
    if (data.user) {
      const userObj = {
        uid: data.user.id,
        email: data.user.email || cleanEmail,
        displayName: data.user.user_metadata?.full_name || data.user.email || cleanEmail.split('@')[0],
      };
      currentAuthUser = userObj;
      localStorage.setItem('supabase_auth_user', JSON.stringify(userObj));
      window.dispatchEvent(new Event('supabase_auth_state_change_local'));
      syncLocalToCloud().catch(() => {});
      return { user: userObj, session: data.session };
    }
    return data;
  } else {
    console.log("⚡ [Supabase] Offline signInWithEmail simulation for:", cleanEmail);
    const mockUser = {
      uid: 'user_' + Math.random().toString(36).substring(2, 11),
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0]
    };
    currentAuthUser = mockUser;
    localStorage.setItem('supabase_auth_user', JSON.stringify(mockUser));
    window.dispatchEvent(new Event('supabase_auth_state_change_local'));
    return { user: mockUser, session: null };
  }
};

export const loginWithEmailOnly = async (email: string, displayName?: string, password?: string) => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error("Por favor, informe um e-mail válido.");
  }

  const typedPassword = password?.trim();
  if (!typedPassword) {
    throw new Error("Por favor, informe sua senha de acesso.");
  }

  // Check known Google UID or previously saved UID
  let knownGoogleUid = typeof localStorage !== 'undefined' ? localStorage.getItem('account_google_uid_' + cleanEmail) : null;
  const localPwdHash = typeof localStorage !== 'undefined' ? localStorage.getItem('user_local_pwd_' + cleanEmail) : null;
  const savedPassword = localPwdHash ? atob(localPwdHash) : null;

  // Self-heal: If knownGoogleUid is NOT a valid 36-character UUID, disregard and remove it so we can regenerate a valid 36-character deterministic UUID!
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (knownGoogleUid && !uuidRegex.test(knownGoogleUid)) {
    console.log(`⚡ [Supabase Local] Corrigindo UID inválido em cache de local login: de ${knownGoogleUid} para um UUID válido`);
    knownGoogleUid = null;
    try {
      localStorage.removeItem('account_google_uid_' + cleanEmail);
    } catch (e) {}
  }

  // Generate deterministic UID based on email for consistent character & data syncing across devices/reloads (ensuring valid UUID for database compatibility)
  const sanitizedUid = knownGoogleUid || getDeterministicUuid(cleanEmail);
  
  const userObj: any = {
    uid: sanitizedUid,
    realUid: knownGoogleUid || sanitizedUid,
    email: cleanEmail,
    displayName: displayName || cleanEmail.split('@')[0],
  };

  // Try real Supabase Local Auth first so the user appears in the local Supabase dashboard
  if (realSupabaseClient) {
    console.log("⚡ [Supabase Local] Autenticando/registrando usuário:", cleanEmail);
    const pwd = typedPassword;

    try {
      // 1. Try to sign in first
      const { data: signInData, error: signInErr } = await realSupabaseClient.auth.signInWithPassword({
        email: cleanEmail,
        password: pwd,
      });

      if (!signInErr && signInData?.user) {
        console.log("⚡ [Supabase Local] Usuário autenticado com sucesso no Supabase local:", signInData.user.id);
        userObj.uid = signInData.user.id;
        userObj.realUid = signInData.user.id;
        if (signInData.user.user_metadata?.display_name || signInData.user.user_metadata?.full_name) {
          userObj.displayName = signInData.user.user_metadata.display_name || signInData.user.user_metadata.full_name;
        }
        try {
          localStorage.setItem('account_google_uid_' + cleanEmail, signInData.user.id);
          localStorage.setItem('user_local_pwd_' + cleanEmail, btoa(typedPassword));
        } catch (e) {}
      } else {
        // Check if password matches local credential configured during prior session
        const matchesLocalPwd = localPwdHash && atob(localPwdHash) === typedPassword;

        if (matchesLocalPwd) {
          console.log("⚡ [Supabase Local] Senha local verificada com sucesso!");
          if (knownGoogleUid) {
            userObj.uid = knownGoogleUid;
            userObj.realUid = knownGoogleUid;
          }
        } else if (localPwdHash && atob(localPwdHash) !== typedPassword) {
          throw new Error("Senha incorreta para esta conta.");
        } else {
          // 2. If user doesn't exist, create it via signUp
          console.log("⚡ [Supabase Local] Criando novo usuário no console do Supabase local:", cleanEmail);
          const { data: signUpData, error: signUpErr } = await realSupabaseClient.auth.signUp({
            email: cleanEmail,
            password: pwd,
            options: {
              data: {
                display_name: displayName || cleanEmail.split('@')[0],
              }
            }
          });

          if (!signUpErr && signUpData?.user) {
            console.log("⚡ [Supabase Local] Usuário criado com sucesso no Supabase local:", signUpData.user.id);
            userObj.uid = signUpData.user.id;
            userObj.realUid = signUpData.user.id;
            try {
              localStorage.setItem('account_google_uid_' + cleanEmail, signUpData.user.id);
              localStorage.setItem('user_local_pwd_' + cleanEmail, btoa(typedPassword));
            } catch (e) {}
          } else if (signUpErr) {
            console.warn("⚠️ [Supabase Local] Aviso ao criar usuário via auth.signUp:", signUpErr.message);
            if (signInErr) {
              const signMsg = signInErr.message?.toLowerCase() || '';
              if (signMsg.includes('invalid login credentials') || signMsg.includes('invalid credentials')) {
                throw new Error("Senha incorreta para esta conta.");
              }
            }
            if (knownGoogleUid) {
              userObj.uid = knownGoogleUid;
              userObj.realUid = knownGoogleUid;
            }
          }
        }
      }
    } catch (authErr: any) {
      if (authErr.message?.includes('Senha incorreta')) {
        throw authErr;
      }
      let errMsg = authErr.message || String(authErr);
      if (errMsg.toLowerCase().includes("invalid login credentials") || errMsg.toLowerCase().includes("invalid credentials")) {
        throw new Error("Senha incorreta para esta conta.");
      }
      if (errMsg.toLowerCase().includes("email not confirmed") || errMsg.toLowerCase().includes("confirmar")) {
        throw new Error("E-mail não confirmado. No painel do Supabase, vá em 'Authentication' -> 'Users' e confirme seu usuário.");
      }
      const isNetworkError = errMsg.includes('fetch') || 
                             errMsg.includes('network') || 
                             errMsg.includes('Failed to fetch') ||
                             errMsg.includes('ENOTFOUND') ||
                             errMsg.includes('timeout') ||
                             authErr.name === 'TypeError';
      if (isNetworkError) {
        throw new Error(`Não foi possível conectar ao Supabase Local em "${currentConfig.url}". A URL está inacessível. Verifique sua conexão e se o Supabase está ativo.`);
      }
      throw authErr;
    }
  } else {
    // Offline mode: check local password
    if (localPwdHash && atob(localPwdHash) !== typedPassword) {
      throw new Error("Senha incorreta para esta conta.");
    }
    try {
      localStorage.setItem('user_local_pwd_' + cleanEmail, btoa(typedPassword));
    } catch (e) {}
  }

  currentAuthUser = userObj;
  localStorage.setItem('supabase_auth_user', JSON.stringify(userObj));
  window.dispatchEvent(new Event('supabase_auth_state_change_local'));
  
  // Synchronize local characters & campaigns immediately with the local database!
  syncLocalToCloud().catch(err => {
    console.warn("⚠️ [Supabase Local] Erro ao sincronizar com banco local após login:", err);
  });
  
  return userObj;
};

export const updateUserPassword = async (newPassword: string, email?: string) => {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }
  const cleanEmail = (email || currentAuthUser?.email || '').trim().toLowerCase();

  if (realSupabaseClient) {
    console.log("⚡ [Supabase Local] Atualizando senha do usuário...");
    try {
      const { data: { session } } = await realSupabaseClient.auth.getSession();
      let updatedViaUser = false;
      
      if (session) {
        if (session.user?.id && cleanEmail) {
          try {
            localStorage.setItem('account_google_uid_' + cleanEmail, session.user.id);
          } catch (e) {}
        }
        const { data, error } = await realSupabaseClient.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          console.warn("⚠️ [Supabase] Erro ao usar updateUser para definir senha:", error.message);
        } else if (data) {
          console.log("✅ [Supabase] Senha definida via updateUser!");
          updatedViaUser = true;
        }
      }

      if (cleanEmail) {
        console.log("⚡ [Supabase] Tentando vincular/configurar credenciais de e-mail e senha para:", cleanEmail);
        
        // 1. Tentar signUp para garantir a criação da identidade de email/senha vinculada
        const { data: signUpData, error: signUpError } = await realSupabaseClient.auth.signUp({
          email: cleanEmail,
          password: newPassword,
        });

        if (!signUpError && signUpData?.user) {
          console.log("✅ [Supabase] Identidade de email criada/vinculada via signUp!");
          if (signUpData.user.id) {
            try {
              localStorage.setItem('account_google_uid_' + cleanEmail, signUpData.user.id);
            } catch (e) {}
          }
        } else {
          if (signUpError) {
            console.warn("⚠️ [Supabase] Detalhes do signUp na criação de senha:", signUpError.message);
          }
          
          // 2. Tentar signIn para confirmar a senha
          const { data: signInData, error: signInError } = await realSupabaseClient.auth.signInWithPassword({
            email: cleanEmail,
            password: newPassword,
          });
          if (!signInError && signInData?.session) {
            console.log("✅ [Supabase] Senha confirmada via signInWithPassword!");
            if (signInData.user?.id) {
              try {
                localStorage.setItem('account_google_uid_' + cleanEmail, signInData.user.id);
              } catch (e) {}
            }
          } else {
            console.warn("⚠️ [Supabase] Não foi possível verificar a senha via signIn:", signInError?.message);
            if (!updatedViaUser) {
              const finalErr = signInError?.message || signUpError?.message || "Não foi possível definir a senha no Supabase Auth. Verifique se o servidor está ativo.";
              throw new Error(finalErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("❌ [Supabase] Exception ao salvar senha no banco de dados:", err);
      throw new Error(err.message || String(err));
    }
  }

  // Registrar senha no usuário local e storage para permitir login offline / com Google id
  if (cleanEmail) {
    try {
      localStorage.setItem('user_local_pwd_' + cleanEmail, btoa(newPassword));
      if (currentAuthUser?.uid) {
        localStorage.setItem('account_google_uid_' + cleanEmail, currentAuthUser.uid);
      }
    } catch (e) {}
  }

  if (currentAuthUser) {
    (currentAuthUser as any).hasPassword = true;
    localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
    window.dispatchEvent(new Event('supabase_auth_state_change_local'));
  }
  return { success: true };
};

export const resetPasswordForEmail = async (email: string) => {
  const cleanEmail = email.trim();
  if (realSupabaseClient) {
    console.log("⚡ [Supabase Local] Redefinindo senha para:", cleanEmail);
    try {
      const { data, error } = await realSupabaseClient.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      });
      if (!error) return data;
    } catch (err) {
      console.warn("⚠️ [Supabase Local] Aviso de redefinição de senha:", err);
    }
  }
  return { success: true };
};

export const loginAsGuest = async () => {
  console.log("⚡ [Supabase] Guest/Offline login initiated.");
  const mockUser = {
    uid: 'guest_user_' + Math.random().toString(36).substring(2, 11),
    email: '',
    displayName: 'Convidado (Offline)'
  };
  currentAuthUser = mockUser;
  localStorage.setItem('supabase_auth_user', JSON.stringify(mockUser));
  window.dispatchEvent(new Event('supabase_auth_state_change_local'));
  window.location.reload();
  return mockUser;
};

export const logout = async () => {
  await auth.signOut();
};

export const handleRedirectResult = async () => {
  if (realSupabaseClient) {
    try {
      const { data: { session } } = await realSupabaseClient.auth.getSession();
      if (session?.user) {
        const userObj = {
          uid: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || session.user.email,
        };
        currentAuthUser = userObj;
        localStorage.setItem('supabase_auth_user', JSON.stringify(userObj));
        return userObj;
      }
    } catch (err) {
      console.warn("⚠️ [Supabase] Failed to check session on redirect:", err);
    }
  }
  return null;
};

export const onAuthStateChanged = (
  _authObj: any,
  callback: (user: any | null) => void,
  errorCallback?: (error: any) => void
) => {
  callback(currentAuthUser);
  
  const listener = () => {
    callback(currentAuthUser);
  };
  
  window.addEventListener('storage', listener);
  window.addEventListener('supabase_auth_state_change_local', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('supabase_auth_state_change_local', listener);
  };
};

export const clearFirestoreCache = async () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('supabase_table_') || key.startsWith('supabase_cache_')) {
        localStorage.removeItem(key);
      }
    }
    console.log("🧹 [Supabase] Local storage cache cleared.");
    window.location.reload();
  } catch (e) {}
};

export const isFirebaseQuotaExceeded = () => {
  return false;
};

export const setSupabaseQuotaExceeded = (exceeded: boolean) => {
  try {
    localStorage.removeItem('supabase_quota_exceeded_flag');
    localStorage.removeItem('firebase_quota_exceeded');
  } catch (e) {}
};

export function checkSupabaseError(error: any, httpStatus?: number | string) {
  if (!error) return;
  const errMsg = String(error.message || error.details || error || "").toLowerCase();
  const status = httpStatus || error.status || error.statusCode || error.code;
  
  if (status === 401 || status === 403 || String(status).startsWith('PGRST3')) {
    console.warn("⚠️ [Supabase Notice] Aviso de permissão/acesso no Supabase (401/403):", errMsg || status);
  }

  // Detect and handle TypeError: Failed to fetch (browser network block, mixed content HTTP/HTTPS)
  const isFailedToFetch = errMsg.includes('failed to fetch') || errMsg.includes('typeerror') || errMsg.includes('networkerror');
  if (isFailedToFetch && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const config = getSupabaseConfig();
    if (config.url.startsWith('http://') && (config.url.includes('127.0.0.1') || config.url.includes('localhost'))) {
      const mixedContentErrorMsg = `Erro de Conexão (Mixed Content): O navegador bloqueou a conexão HTTP com o Supabase Local (${config.url}) porque este app está rodando de forma segura (HTTPS). Para que os dados sejam salvos em tempo real na nuvem local, você deve usar um túnel HTTPS seguro (como o Cloudflare Tunnel \`cloudflared\` ou \`ngrok\`) ou acessar o aplicativo localmente em modo HTTP puro. Suas fichas continuarão sendo salvas de forma segura no seu Navegador (Modo Offline)!`;
      console.warn("🚨 [Supabase Mixed Content Check] " + mixedContentErrorMsg);
      
      // Dispatch a custom event to show a beautiful banner or modal to the user
      window.dispatchEvent(new CustomEvent('supabase_connection_mixed_content_error', { 
        detail: { message: mixedContentErrorMsg, url: config.url } 
      }));
    }
  }
}

export const handleFirestoreError = (error: unknown, operationType: any, path: string | null) => {
  checkSupabaseError(error);
};

export const db = {} as any;

export type FirebaseUserLike = any;

// === COMPATIBILITY WRAPPERS FOR FIRESTORE INTERFACES ===
export const doc = (database: any, collectionName: string, ...segments: string[]) => {
  return {
    collection: collectionName,
    segments: segments,
    get path() {
      return [collectionName, ...segments].join('/');
    },
    get id() {
      return segments[segments.length - 1];
    }
  };
};

export const getDoc = async (docRef: any) => {
  try {
    const res = await supabase.from(docRef.collection).select('*').eq('id', docRef.id).single();
    if (res.data) {
      const val = docRef.collection === 'characters' ? res.data.data : res.data;
      return {
        exists: () => true,
        data: () => val
      };
    }
  } catch (e) {
    console.error("Error in compat getDoc:", e);
  }
  return { exists: () => false, data: () => null };
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  try {
    const cleanData = removeUndefinedFields({ ...data });
    if (cleanData.updatedAt) {
      cleanData.updatedAt = new Date().toISOString();
    }

    if (docRef.collection === 'characters') {
      let merged = cleanData;
      if (options?.merge) {
        const snap = await getDoc(docRef);
        const currentData = snap.exists() ? snap.data() : null;
        merged = { ...(currentData || {}), ...cleanData };
      }
      
      await supabase.from(docRef.collection).insert({
        id: docRef.id,
        user_id: merged.userId || currentAuthUser?.uid || "",
        user_email: merged.userEmail || currentAuthUser?.email || "",
        campaign_id: merged.campaignId || null,
        data: merged,
        updated_at: new Date().toISOString()
      });
    } else {
      await supabase.from(docRef.collection).insert({
        id: docRef.id,
        ...cleanData
      });
    }
  } catch (e) {
    console.error("Error in compat setDoc:", e);
  }
};

export const updateDoc = async (docRef: any, updates: any) => {
  try {
    const cleanUpdates = removeUndefinedFields({ ...updates });
    if (cleanUpdates.updatedAt) {
      cleanUpdates.updatedAt = new Date().toISOString();
    }

    if (docRef.collection === 'characters') {
      const snap = await getDoc(docRef);
      const currentData = snap.exists() ? snap.data() : null;
      const merged = { ...(currentData || {}), ...cleanUpdates };
      
      await supabase.from(docRef.collection).insert({
        id: docRef.id,
        user_id: merged.userId || currentAuthUser?.uid || "",
        user_email: merged.userEmail || currentAuthUser?.email || "",
        campaign_id: merged.campaignId || null,
        data: merged,
        updated_at: new Date().toISOString()
      });
    } else {
      await supabase.from(docRef.collection).update(cleanUpdates).eq('id', docRef.id);
    }
  } catch (e) {
    console.error("Error in compat updateDoc:", e);
  }
};

export const writeBatch = (database: any) => {
  const tasks: (() => Promise<void>)[] = [];

  return {
    set: (docRef: any, data: any, options?: any) => {
      tasks.push(async () => {
        await setDoc(docRef, data, options);
      });
    },
    update: (docRef: any, updates: any) => {
      tasks.push(async () => {
        await updateDoc(docRef, updates);
      });
    },
    delete: (docRef: any) => {
      tasks.push(async () => {
        await supabase.from(docRef.collection).delete().eq('id', docRef.id);
      });
    },
    commit: async () => {
      try {
        for (const t of tasks) {
          await t();
        }
      } catch (error) {
        console.error(`[Supabase compat batch.commit Error]:`, error);
      }
    }
  };
};

export const serverTimestamp = () => new Date().toISOString();
export const arrayUnion = (...elements: any[]) => elements;

// === QUERY AND SNAPSHOT INTERFACE COMPATIBILITY FOR SERVICES ===
export const collection = (database: any, path: string) => {
  return { path };
};

export const where = (field: string, operator: string, value: any) => {
  return { type: 'where', field, operator, value };
};

export const or = (...clauses: any[]) => {
  return { type: 'or', clauses };
};

export const query = (collectionObj: any, ...constraints: any[]) => {
  return { collection: collectionObj, constraints };
};

export const onSnapshot = (
  queryObj: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) => {
  const tableName = queryObj.collection.path;
  let active = true;
  let isFetching = false;
  let lastDataSerialized = '';

  const fetchAndNotify = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      // Query the builder representing this table
      const builder = new ResilientQueryBuilder(tableName);
      
      // Apply filters dynamically from query constraints to limit rows returned by the database!
      for (const constraint of queryObj.constraints) {
        if (constraint.type === 'where') {
          const { field, operator, value } = constraint;
          if (operator === '==' || operator === '===') {
            builder.eq(field, value);
          }
        } else if (constraint.type === 'or') {
          const clauses = constraint.clauses;
          const parts: string[] = [];
          for (const clause of clauses) {
            if (clause.type === 'where') {
              const { field, operator, value } = clause;
              if (operator === '==' || operator === '===') {
                parts.push(`${field}.eq.${value}`);
              }
            }
          }
          if (parts.length > 0) {
            builder.or(parts.join(','));
          }
        }
      }

      const { data } = await builder;
      
      if (!active || !data) return;

      let filtered = [...data];

      // Process query constraints in memory
      for (const constraint of queryObj.constraints) {
        if (constraint.type === 'where') {
          const { field, operator, value } = constraint;
          filtered = filtered.filter(row => {
            const rowValue = getEntityValue(row, field);
            if (operator === '==' || operator === '===') {
              return matchesFieldValue(rowValue, value, field);
            }
            return true;
          });
        } else if (constraint.type === 'or') {
          filtered = filtered.filter(row => {
            return constraint.clauses.some((clause: any) => {
              if (clause.type === 'where') {
                const { field, operator, value } = clause;
                const rowValue = getEntityValue(row, field);
                if (operator === '==' || operator === '===') {
                  return matchesFieldValue(rowValue, value, field);
                }
              }
              return false;
            });
          });
        }
      }

      const serialized = JSON.stringify(filtered);
      if (serialized === lastDataSerialized) {
        return; // Skip notifying if data hasn't changed
      }
      lastDataSerialized = serialized;

      const docs = filtered.map(row => {
        return {
          id: row.id,
          data: () => row
        };
      });

      const mockSnapshot = {
        docs,
        forEach: (callback: (doc: any) => void) => {
          docs.forEach(callback);
        }
      };

      onNext(mockSnapshot);
    } catch (err) {
      console.error(`[onSnapshot compat ${tableName}] Error:`, err);
    } finally {
      isFetching = false;
    }
  };

  fetchAndNotify();

  // Listen to local changes
  const changeListener = () => {
    fetchAndNotify();
  };
  window.addEventListener(`supabase_local_change_${tableName}`, changeListener);

  // Setup interval polling fallback (750ms for real-time VTT tables, 3s for others)
  const pollFrequency = (tableName === 'tokens' || tableName === 'campaign_configs' || tableName === 'vtt_logs') ? 750 : 3000;
  const interval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    fetchAndNotify();
  }, pollFrequency);

  // Setup Supabase Realtime channel listener for sub-second synchronization
  let realtimeChannel: any = null;
  if (realSupabaseClient) {
    try {
      const channelId = `realtime_${tableName}_${Math.random().toString(36).substring(2, 7)}`;
      realtimeChannel = realSupabaseClient.channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          () => {
            fetchAndNotify();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn(`⚠️ [Realtime ${tableName}] Could not establish realtime channel:`, e);
    }
  }

  return () => {
    active = false;
    clearInterval(interval);
    window.removeEventListener(`supabase_local_change_${tableName}`, changeListener);
    if (realtimeChannel && realSupabaseClient) {
      try {
        realSupabaseClient.removeChannel(realtimeChannel);
      } catch (e) {}
    }
  };
};
