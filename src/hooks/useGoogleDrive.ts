import { useState, useEffect, useCallback } from 'react';
import { AppState } from '../types';

export function useGoogleDrive(appState: AppState, onStateUpdate: (newState: AppState) => void) {
  // Inicializa o estado baseado no que já sabemos localmente para evitar flashes de erro
  const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem('google_drive_connected_at'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Função auxiliar para injetar o Token em todas as chamadas
  const authFetch = useCallback(async (url: string, options: any = {}) => {
    const token = localStorage.getItem('google_drive_access_token');
    const headers = {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
    return fetch(url, { ...options, headers });
  }, []);

  const checkStatus = useCallback(async (retryCount = 0): Promise<boolean> => {
    try {
      // Adicionando cache-busting para evitar que o Cloudflare entregue JSON antigo
      const res = await authFetch(`/api/drive/status?cb=${Date.now()}`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("O servidor retornou HTML em vez de JSON (Erro de Rota/Cache).");
      }

      const data = await res.json();
      if (data.connected) {
        setIsConnected(true);
        setError(null); // LIMPEZA CRÍTICA: Se conectou, o erro some
        localStorage.setItem('google_drive_connected_at', Date.now().toString());
      } else {
        // TENTA RECONEXÃO SILENCIOSA SE TIVERMOS TOKENS NO LOCALSTORAGE
        const savedTokens = localStorage.getItem('google_drive_tokens');
        const savedAccessToken = localStorage.getItem('google_drive_access_token');
        
        if (savedTokens && retryCount === 0) {
            console.log("Tentando reconexão silenciosa com tokens salvos...");
            try {
                const reconRes = await fetch('/api/auth/reconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        tokens: JSON.parse(savedTokens),
                        accessToken: savedAccessToken
                    })
                });
                if (reconRes.ok) {
                    return checkStatus(retryCount + 1);
                }
            } catch (e) { /* silent fail */ }
        }

        setIsConnected(false);
        localStorage.removeItem('google_drive_connected_at');
        // Não removemos o access_token nem os tokens para permitir reconexão futura 
        // a menos que o logout seja manual
      }
      return data.connected;
    } catch (err: any) {
      console.error("Status check failed", err);
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 1500));
        return checkStatus(retryCount + 1);
      }
      return false;
    }
  }, [authFetch]);

  const fetchFromDrive = useCallback(async (retryCount = 0) => {
    setIsSyncing(true);
    // Não limpamos o erro aqui para não causar "flashing" se já tivermos um erro crítico
    try {
      const res = await authFetch(`/api/drive/fetch?cb=${Date.now()}`);
      
      if (res.status === 401) {
        setIsConnected(false);
        if (retryCount < 2) {
            await new Promise(r => setTimeout(r, 2000));
            return fetchFromDrive(retryCount + 1);
        }
        throw new Error("Sessão não autorizada. Reconecte o Drive.");
      }

      if (!res.ok) {
        throw new Error(`Servidor respondeu com erro ${res.status}.`);
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Resposta inválida (Interferência de Rede/Proxy).");
      }

      const { data } = await res.json();
      if (data) {
        onStateUpdate(data);
        setLastSync(new Date().toLocaleTimeString());
        setError(null);
      }
    } catch (err: any) {
      console.error("Drive Fetch Error:", err);
      // Só mostra o erro se não estivermos em retentativa
      if (retryCount >= 2 || !isConnected) {
        setError(err.message || "Erro de conexão desconhecido.");
      }
    } finally {
      setIsSyncing(false);
    }
  }, [onStateUpdate, isConnected, authFetch]);

  const syncToDrive = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await authFetch(`/api/drive/sync?cb=${Date.now()}`, {
        method: 'POST',
        body: JSON.stringify({ data: appState })
      });
      
      if (res.status === 401) {
          setIsConnected(false);
          throw new Error("Sessão expirada ao salvar.");
      }

      if (!res.ok) throw new Error("Falha ao salvar na nuvem.");
      setLastSync(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "Erro ao salvar na nuvem.");
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  }, [appState, authFetch]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsConnected(false);
      localStorage.removeItem('google_drive_connected_at');
      localStorage.removeItem('google_drive_login_success');
      localStorage.removeItem('google_drive_access_token');
      localStorage.removeItem('google_drive_tokens');
      setLastSync(null);
    } catch (err) {
      setError("Falha ao deslogar.");
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // Polling de fallback caso o postMessage falhe (comum em iframes/webviews)
    const pollInterval = setInterval(() => {
        const loginSignal = localStorage.getItem('google_drive_login_success');
        if (loginSignal) {
            console.log("Detectado sinal de login no localStorage!");
            localStorage.removeItem('google_drive_login_success');
            setError(null); // Limpa erro pendente imediatamente ao logar
            // Delay mais generoso para Cloudflare e sessões lentas (3 seg)
            setTimeout(() => {
              checkStatus().then(connected => {
                  if (connected) fetchFromDrive();
              });
            }, 3000);
        }
    }, 1000);

    const handleMessage = (event: MessageEvent) => {
      // Aceitar mensagens de qualquer origem por conta do proxy/iframe
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log("OAuth Sucesso recebido via postMessage!");
        setError(null);
        // Também aplicamos o delay aqui
        setTimeout(() => {
          setIsConnected(true);
          fetchFromDrive();
        }, 3000);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
        window.removeEventListener('message', handleMessage);
        clearInterval(pollInterval);
    };
  }, [checkStatus, fetchFromDrive]);

  return {
    isConnected,
    isSyncing,
    lastSync,
    error,
    checkStatus,
    fetchFromDrive,
    syncToDrive,
    handleLogout,
    setError
  };
}
