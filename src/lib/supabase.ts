import { createClient } from '@supabase/supabase-js';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Read and sanitize Supabase environment variables
let rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
if (rawUrl) {
  // Fix common typo where "https" is accidentally concatenated at the end of the domain (e.g., fpidgwgounwjlzxforjl.supabase.cohttps)
  if (rawUrl.endsWith("cohttps")) {
    rawUrl = rawUrl.slice(0, -5);
  } else if (rawUrl.includes("supabase.cohttps")) {
    rawUrl = rawUrl.replace("supabase.cohttps", "supabase.co");
  }
  // Remove any trailing slash
  if (rawUrl.endsWith("/")) {
    rawUrl = rawUrl.slice(0, -1);
  }
  // Ensure it starts with https:// if it has only the domain name
  if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl;
  }
}

const supabaseUrl = rawUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const isConfigured = supabaseUrl && supabaseAnonKey && 
                      supabaseUrl !== "placeholder_url" && 
                      supabaseAnonKey !== "placeholder_key" &&
                      supabaseUrl.startsWith('http') &&
                      supabaseUrl.includes('.supabase.co');

export const realSupabaseClient = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isConfigured) {
  console.warn("⚠️ [Supabase] Client not configured. Operating in high-performance Local Offline-First mode.");
} else {
  console.log("⚡ [Supabase] Connected directly to Supabase cloud database.");
}

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
    const data = localStorage.getItem(`supabase_table_${table}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalTable(table: string, data: any[]) {
  try {
    localStorage.setItem(`supabase_table_${table}`, JSON.stringify(data));
    // Trigger any local change listeners
    window.dispatchEvent(new CustomEvent(`supabase_local_change_${table}`));
  } catch (e) {
    console.error(`Error saving local table ${table}:`, e);
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
        const { data, error } = (await withTimeout(
          realSupabaseClient.from(this.table).upsert(values),
          2000
        )) as any;
        if (!error) {
          // Mirror to local table for offline robustness
          const local = getLocalTable(this.table);
          for (const item of items) {
            const index = local.findIndex(x => x.id === item.id);
            if (index >= 0) local[index] = { ...local[index], ...item };
            else local.push(item);
          }
          saveLocalTable(this.table, local);
          return { data, error: null };
        }
        console.warn(`[Supabase Cloud Write Error] falling back to local storage:`, error);
      } catch (err) {
        console.warn(`[Supabase Cloud Exception] falling back to local storage:`, err);
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
                  const { data, error } = (await withTimeout(
                    realSupabaseClient
                      .from(this.table)
                      .update(cleanValues)
                      .eq(column, value),
                    2000
                  )) as any;
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
                    const res = { data, error: null };
                    return onfulfilled ? onfulfilled(res) : res;
                  }
                  console.warn(`[Supabase Cloud Update Error] falling back to local:`, error);
                } catch (err) {
                  console.warn(`[Supabase Cloud Update Exception] falling back to local:`, err);
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
                  const { data, error } = (await withTimeout(
                    realSupabaseClient
                      .from(this.table)
                      .delete()
                      .eq(column, value),
                    2000
                  )) as any;
                  if (!error) {
                    const local = getLocalTable(this.table);
                    const filtered = local.filter(item => String(item[column]) !== String(value));
                    saveLocalTable(this.table, filtered);
                    const res = { data, error: null };
                    return onfulfilled ? onfulfilled(res) : res;
                  }
                } catch (err) {
                  console.warn(`[Supabase Cloud Delete Exception] falling back to local:`, err);
                }
              }

              const local = getLocalTable(this.table);
              const filtered = local.filter(item => String(item[column]) !== String(value));
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

          const { data, error } = (await withTimeout(builder, 2000)) as any;
          if (!error && data) {
            rows = Array.isArray(data) ? data : [data];
            loadedFromCloud = true;
            
            // Sync with local memory and storage cache
            const local = getLocalTable(this.table);

            // Filter out any rows belonging to other users to prevent cross-user data leak in localStorage cache!
            let filteredLocal = local.filter(item => {
              if (this.table === 'characters') {
                const isOwn = !item.user_id || item.user_id.startsWith('guest_') || (currentAuthUser && (item.user_id === currentAuthUser.uid || item.user_email === currentAuthUser.email));
                return isOwn;
              }
              if (this.table === 'campaigns') {
                const isOwn = !item.master_id || item.master_id.startsWith('guest_') || (currentAuthUser && (item.master_id === currentAuthUser.uid || item.master_email === currentAuthUser.email));
                return isOwn;
              }
              return true;
            });

            const cloudIds = new Set(rows.map(r => r.id));

            // Mark all rows returned from the cloud as remote synced
            for (const item of rows) {
              item.is_remote_synced = true;
              if (item.data) {
                item.data.isRemoteSynced = true;
              }
            }

            // Auto-detect and remove previously synced items that match current filters but are no longer in the cloud (DELETED)
            filteredLocal = filteredLocal.filter(l => {
              const isPreviouslySynced = l.is_remote_synced === true || l.isRemoteSynced === true || (l.data && (l.data.isRemoteSynced === true || l.data.is_remote_synced === true));
              if (!isPreviouslySynced) return true; // Keep unsynced, brand-new local items
              if (cloudIds.has(l.id)) return true; // Keep items that still exist on the cloud

              // Apply our filter checks to see if this item belongs to the query dataset
              let matchesFilters = true;
              for (const f of this.filters) {
                if (f.operator === '==') {
                  const val = l[f.column] !== undefined ? l[f.column] : (l.data ? l.data[f.column] : undefined);
                  if (String(val) !== String(f.value)) {
                    matchesFilters = false;
                    break;
                  }
                }
              }

              if (matchesFilters) {
                // Item was synced, matches filters, but is no longer on the cloud -> DELETED
                console.log(`🗑️ [Supabase Sync] Purging deleted item from local cache: ${this.table} ID ${l.id}`);
                return false;
              }

              return true;
            });

            // Merge cloud data to local, overwriting older or duplicates
            for (const item of rows) {
              const idx = filteredLocal.findIndex(x => x.id === item.id);
              if (idx >= 0) filteredLocal[idx] = { ...filteredLocal[idx], ...item };
              else filteredLocal.push(item);
            }
            saveLocalTable(this.table, filteredLocal);

            // Temporarily include local-only items that match the filters but are not in the cloud yet
            const localOnly = filteredLocal.filter(l => {
              if (cloudIds.has(l.id)) return false;
              
              // Apply simple equality filter check
              for (const f of this.filters) {
                if (f.operator === '==') {
                  const val = l[f.column] !== undefined ? l[f.column] : (l.data ? l.data[f.column] : undefined);
                  if (String(val) !== String(f.value)) return false;
                }
              }
              return true;
            });

            if (localOnly.length > 0) {
              rows = [...rows, ...localOnly];
            }
          }
        } catch (err) {
          console.warn(`[Supabase Cloud Read Exception] falling back to offline:`, err);
        }
      }

      if (!loadedFromCloud) {
        // Load offline fallback
        rows = getLocalTable(this.table);

        // Apply filters in memory
        for (const f of this.filters) {
          if (f.operator === '==') {
            rows = rows.filter(r => String(r[f.column]) === String(f.value));
          } else if (f.operator === 'in') {
            rows = rows.filter(r => Array.isArray(f.value) && f.value.map(String).includes(String(r[f.column])));
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
                  return String(row[col]) === String(val);
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
  
  const userObj = {
    uid: session.user?.id || "",
    email: session.user?.email || "",
    displayName: session.user?.user_metadata?.full_name || session.user?.email || "",
  };

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

export const syncLocalToCloud = async () => {
  if (isSyncing || !realSupabaseClient || !currentAuthUser) return;
  
  if (currentAuthUser.uid && currentAuthUser.uid.startsWith('guest_')) {
    console.log("⚡ [Sync] Active user is guest, skipping cloud upload.");
    return;
  }

  isSyncing = true;
  console.log("⚡ [Sync] Starting offline to online synchronization...");

  try {
    const userId = currentAuthUser.uid;
    const userEmail = currentAuthUser.email || "";

    // 1. Sync Characters
    const localCharacters = getLocalTable('characters');
    if (localCharacters.length > 0) {
      console.log(`⚡ [Sync] Found ${localCharacters.length} local characters. Verifying alignment...`);
      
      const charactersToUpload = [];
      const updatedLocalCharacters = [];

      for (const item of localCharacters) {
        let needsUpload = false;
        const charData = item.data || item;

        // Only adopt character if it has no user_id or is owned by guest. NEVER adopt registered characters from other users!
        if (!item.user_id || item.user_id.startsWith('guest_')) {
          console.log(`⚡ [Sync] Migrating character ${charData.nome || item.id} from ${item.user_id} to ${userId}`);
          item.user_id = userId;
          item.user_email = userEmail;
          
          if (item.data) {
            item.data.userId = userId;
            item.data.userEmail = userEmail;
          } else {
            item.userId = userId;
            item.userEmail = userEmail;
          }
          needsUpload = true;
          charactersToUpload.push(item);
        } else if (item.user_id === userId) {
          needsUpload = true;
          charactersToUpload.push(item);
        } else {
          console.log(`⚠️ [Sync] Skipping other user's character: ${charData.nome || item.id} (owner: ${item.user_id})`);
        }

        // Only retain our own, guest, or newly adopted characters in the local cache table
        const isBelongingToUs = !item.user_id || item.user_id.startsWith('guest_') || item.user_id === userId;
        if (isBelongingToUs) {
          updatedLocalCharacters.push(item);
        }
      }

      for (const item of charactersToUpload) {
        try {
          const charData = item.data || item;
          console.log(`⚡ [Sync] Uploading character ${charData.nome || item.id} to cloud...`);
          
          // Mark as remote synced
          item.is_remote_synced = true;
          if (item.data) {
            item.data.isRemoteSynced = true;
          }

          await realSupabaseClient.from('characters').upsert({
            id: item.id,
            user_id: item.user_id,
            user_email: item.user_email,
            campaign_id: item.campaign_id || charData.campaignId || null,
            data: charData,
            updated_at: new Date().toISOString()
          });
        } catch (uploadErr) {
          console.error(`⚡ [Sync] Error uploading character ${item.id}:`, uploadErr);
        }
      }

      // Save local table after updating elements in-place with is_remote_synced flag
      saveLocalTable('characters', updatedLocalCharacters);
    }

    // 2. Sync Campaigns
    const localCampaigns = getLocalTable('campaigns');
    if (localCampaigns.length > 0) {
      console.log(`⚡ [Sync] Found ${localCampaigns.length} local campaigns. Verifying alignment...`);
      
      const campaignsToUpload = [];
      const updatedLocalCampaigns = [];

      for (const item of localCampaigns) {
        let needsUpload = false;
        const campData = item.data || item;

        // Only adopt campaign if it has no master_id or is owned by guest. NEVER adopt campaigns from other users!
        if (!item.master_id || item.master_id.startsWith('guest_')) {
          console.log(`⚡ [Sync] Migrating campaign ${item.name || item.id} from ${item.master_id} to ${userId}`);
          item.master_id = userId;
          item.master_email = userEmail;
          
          if (item.data) {
            item.data.masterId = userId;
            item.data.masterEmail = userEmail;
          } else {
            item.masterId = userId;
            item.masterEmail = userEmail;
          }
          needsUpload = true;
          campaignsToUpload.push(item);
        } else if (item.master_id === userId) {
          needsUpload = true;
          campaignsToUpload.push(item);
        } else {
          console.log(`⚠️ [Sync] Skipping other user's campaign: ${item.name || item.id} (owner: ${item.master_id})`);
        }

        // Only retain our own, guest, or newly adopted campaigns in the local cache table
        const isBelongingToUs = !item.master_id || item.master_id.startsWith('guest_') || item.master_id === userId;
        if (isBelongingToUs) {
          updatedLocalCampaigns.push(item);
        }
      }

      saveLocalTable('campaigns', updatedLocalCampaigns);

      for (const item of campaignsToUpload) {
        try {
          const campData = item.data || item;
          console.log(`⚡ [Sync] Uploading campaign ${item.name || item.id} to cloud...`);
          
          await realSupabaseClient.from('campaigns').upsert({
            id: item.id,
            master_id: item.master_id,
            master_email: item.master_email,
            name: item.name || campData.name || "Sem Nome",
            invite_code: item.invite_code || campData.inviteCode || "",
            data: campData,
            updated_at: new Date().toISOString()
          });
        } catch (uploadErr) {
          console.error(`⚡ [Sync] Error uploading campaign ${item.id}:`, uploadErr);
        }
      }
    }

    console.log("⚡ [Sync] Synchronization complete!");
    window.dispatchEvent(new Event('supabase_local_change_characters'));
    window.dispatchEvent(new Event('supabase_local_change_campaigns'));
  } catch (err) {
    console.error("⚡ [Sync] Exception during synchronization:", err);
  } finally {
    isSyncing = false;
  }
};

// Auto sync on module load if logged in
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncLocalToCloud().catch(err => console.error("Error in auto syncLocalToCloud:", err));
  }, 2000);
}

if (realSupabaseClient) {
  try {
    realSupabaseClient.auth.getSession().then(({ data: { session } }) => {
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
          console.log(`📡 [Local Channel Signal] table change detected for: ${table}`);
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
    currentAuthUser = null;
    localStorage.removeItem('supabase_auth_user');
    
    // Clear all local database/character states to prevent cross-user data remnants on reload!
    localStorage.removeItem('rpg_system_x_chars');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('supabase_table_') || key.startsWith('supabase_cache_') || key.startsWith('campaign_characters_')) {
        localStorage.removeItem(key);
      }
    }

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
      email: 'mestre.demons@gmail.com',
      displayName: 'Mestre Hefesto (Offline)'
    };
    currentAuthUser = mockUser;
    localStorage.setItem('supabase_auth_user', JSON.stringify(mockUser));
    window.location.reload();
    return mockUser;
  }
};

export const loginAsGuest = async () => {
  console.log("⚡ [Supabase] Guest/Offline login initiated.");
  const mockUser = {
    uid: 'guest_user_' + Math.random().toString(36).substring(2, 11),
    email: 'mestre.demons@gmail.com',
    displayName: 'Mestre Hefesto (Offline)'
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

export const isFirebaseQuotaExceeded = () => false;

export const handleFirestoreError = (error: unknown, operationType: any, path: string | null) => {
  console.warn("⚠️ [Supabase] Firebase handler suppressed. Error:", error);
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

  const fetchAndNotify = async () => {
    if (!active) return;
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
            const rowValue = row[field] !== undefined ? row[field] : (row.data ? row.data[field] : undefined);
            if (operator === '==' || operator === '===') {
              return String(rowValue) === String(value);
            }
            return true;
          });
        } else if (constraint.type === 'or') {
          filtered = filtered.filter(row => {
            return constraint.clauses.some((clause: any) => {
              if (clause.type === 'where') {
                const { field, operator, value } = clause;
                const rowValue = row[field] !== undefined ? row[field] : (row.data ? row.data[field] : undefined);
                if (operator === '==' || operator === '===') {
                  return String(rowValue) === String(value);
                }
              }
              return false;
            });
          });
        }
      }

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
    }
  };

  fetchAndNotify();

  // Listen to local changes
  const changeListener = () => {
    fetchAndNotify();
  };
  window.addEventListener(`supabase_local_change_${tableName}`, changeListener);

  // Setup interval polling fallback (every 4s) to capture remote changes
  const interval = setInterval(fetchAndNotify, 4000);

  return () => {
    active = false;
    clearInterval(interval);
    window.removeEventListener(`supabase_local_change_${tableName}`, changeListener);
  };
};
