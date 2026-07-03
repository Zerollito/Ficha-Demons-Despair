import { createClient } from '@supabase/supabase-js';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Read Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = supabaseUrl && supabaseAnonKey && 
                      supabaseUrl !== "placeholder_url" && 
                      supabaseAnonKey !== "placeholder_key" &&
                      supabaseUrl.startsWith('http');

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
        const { data, error } = await realSupabaseClient.from(this.table).upsert(values);
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
                  const { data, error } = await realSupabaseClient
                    .from(this.table)
                    .update(cleanValues)
                    .eq(column, value);
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
                  const { data, error } = await realSupabaseClient
                    .from(this.table)
                    .delete()
                    .eq(column, value);
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

          const { data, error } = await builder;
          if (!error && data) {
            rows = Array.isArray(data) ? data : [data];
            loadedFromCloud = true;
            
            // Sync with local memory and storage cache
            const local = getLocalTable(this.table);
            // Merge cloud data to local, overwriting older or duplicates
            for (const item of rows) {
              const idx = local.findIndex(x => x.id === item.id);
              if (idx >= 0) local[idx] = { ...local[idx], ...item };
              else local.push(item);
            }
            saveLocalTable(this.table, local);
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

if (realSupabaseClient) {
  realSupabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      currentAuthUser = {
        uid: session.user.id,
        email: session.user.email,
        displayName: session.user.user_metadata?.full_name || session.user.email,
      };
      localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
    }
  }).catch(() => {});

  realSupabaseClient.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentAuthUser = {
        uid: session.user.id,
        email: session.user.email,
        displayName: session.user.user_metadata?.full_name || session.user.email,
      };
      localStorage.setItem('supabase_auth_user', JSON.stringify(currentAuthUser));
    } else {
      currentAuthUser = null;
      localStorage.removeItem('supabase_auth_user');
    }
  });
}

// Core exported objects
export const supabase = {
  from: (table: string) => {
    return new ResilientQueryBuilder(table);
  },
  channel: (channelId: string) => {
    return {
      on: (event: string, config: any, callback: () => void) => {
        // Setup local custom event listener
        const table = config.table || 'campaigns';
        const listener = () => callback();
        window.addEventListener(`supabase_local_change_${table}`, listener);
        (window as any)[`chan_unsub_${channelId}`] = () => {
          window.removeEventListener(`supabase_local_change_${table}`, listener);
        };
        return this;
      },
      subscribe: () => {
        return {
          unsubscribe: () => {
            const unsub = (window as any)[`chan_unsub_${channelId}`];
            if (unsub) unsub();
          }
        };
      }
    } as any;
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
      await realSupabaseClient.auth.signOut();
    }
    currentAuthUser = null;
    localStorage.removeItem('supabase_auth_user');
    window.location.reload();
  }
};

export const loginWithGoogle = async () => {
  if (realSupabaseClient) {
    console.log("⚡ [Supabase] Initiating OAuth signInWithOAuth via Google...");
    const { data, error } = await realSupabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  } else {
    // Generate an instant mock user for guest/preview convenience when url not provided
    console.log("⚡ [Supabase] Guest login generated instantly (no Supabase URL configured).");
    const mockUser = {
      uid: 'guest_user_' + Math.random().toString(36).substr(2, 9),
      email: 'mestre.demons@gmail.com',
      displayName: 'Mestre Hefesto (Offline)'
    };
    currentAuthUser = mockUser;
    localStorage.setItem('supabase_auth_user', JSON.stringify(mockUser));
    window.location.reload();
    return mockUser;
  }
};

export const logout = async () => {
  await auth.signOut();
};

export const handleRedirectResult = async () => {
  if (realSupabaseClient) {
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
  return () => {
    window.removeEventListener('storage', listener);
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
