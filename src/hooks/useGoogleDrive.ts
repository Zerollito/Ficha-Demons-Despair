import { useState, useEffect, useCallback } from 'react';
import { AppState } from '../types';

export function useGoogleDrive(appState: AppState, onStateUpdate: (newState: AppState) => void) {
  // Inicializa o estado baseado no que já sabemos localmente para evitar flashes de erro
  const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem('google_drive_connected_at'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userAccount, setUserAccount] = useState<string | null>(localStorage.getItem('google_drive_user_email'));

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

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/google/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setUserAccount(data.email);
          localStorage.setItem('google_drive_user_email', data.email);
        }
      }
    } catch (e) { console.error("Profile fetch fail", e); }
  }, [authFetch]);

  const checkStatus = useCallback(async (retryCount = 0): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/drive/status?cb=${Date.now()}`);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("O servidor retornou HTML em vez de JSON (Erro de Rota/Cache).");
      }

      const data = await res.json();
      if (data.connected) {
        setIsConnected(true);
        setError(null);
        localStorage.setItem('google_drive_connected_at', Date.now().toString());
        fetchProfile();
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
        setUserAccount(null);
        localStorage.removeItem('google_drive_connected_at');
        localStorage.removeItem('google_drive_user_email');
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
  }, [authFetch, fetchProfile]);

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
        console.log("Ficha recuperada do Drive com sucesso!");
        onStateUpdate(data);
        setLastSync(new Date().toLocaleTimeString());
        setError(null);
        return true; 
      } else {
        // ARQUIVO NÃO ENCONTRADO: Se acabamos de logar, vamos subir a ficha atual como backup inicial
        console.log("Arquivo não encontrado no Drive. Fazendo upload inicial...");
        await syncToDrive();
        setLastSync(new Date().toLocaleTimeString());
        return false;
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

  const syncToDrive = useCallback(async (retryCount = 0) => {
    setIsSyncing(true);
    // Não limpamos o erro aqui imediatamente para evitar flashing se for erro persistente
    try {
      const res = await authFetch(`/api/drive/sync?cb=${Date.now()}`, {
        method: 'POST',
        body: JSON.stringify({ data: appState })
      });
      
      if (res.status === 401) {
          console.warn("Sessão expirada detectada no sync. Tentando reconectar...");
          // Tenta reconectar e repetir uma vez
          if (retryCount === 0) {
              const connected = await checkStatus();
              if (connected) {
                  return syncToDrive(retryCount + 1);
              }
          }
          setIsConnected(false);
          throw new Error("Sessão expirada. Reconecte o Drive.");
      }

      if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao salvar na nuvem.");
      }
      
      setLastSync(new Date().toLocaleTimeString());
      setError(null);
      return true;
    } catch (err: any) {
      console.error("Sync Error:", err);
      setError(err.message || "Erro ao sincronizar com a nuvem.");
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [appState, authFetch, checkStatus]);

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
    // 0. CAPTURA DE FALLBACK (Caso o login venha via URL Query String)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('google_auth_token');
    if (urlToken) {
        console.log("Token detectado na URL! Aplicando fallback...");
        localStorage.setItem('google_drive_access_token', urlToken);
        // Remove o parâmetro da URL de forma "limpa" para não sujar o histórico
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        setIsConnected(true);
        setTimeout(() => checkStatus().then(conn => { if(conn) fetchFromDrive(); }), 500);
    }

    checkStatus();

    // Polling de fallback caso o postMessage falhe (comum em iframes/webviews)
    const pollInterval = setInterval(() => {
        const loginSignal = localStorage.getItem('google_drive_login_success');
        if (loginSignal) {
            console.log("Detectado sinal de login no localStorage!");
            localStorage.removeItem('google_drive_login_success');
            setError(null); 
            // Trigger imediato
            checkStatus().then(connected => {
                if (connected) fetchFromDrive();
            });
        }
    }, 1000);

    const handleMessage = (event: MessageEvent) => {
      // Aceitar mensagens de qualquer origem por conta do proxy/iframe
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log("OAuth Sucesso recebido via postMessage!");
        const { token, tokens } = event.data;
        
        // SALVAMENTO IMEDIATO LOCAL PARA EVITAR RELOGIN
        if (token) localStorage.setItem('google_drive_access_token', token);
        if (tokens) localStorage.setItem('google_drive_tokens', JSON.stringify(tokens));
        localStorage.setItem('google_drive_connected_at', Date.now().toString());
        
        // CONFIRMAÇÃO (Handshake): Avisa o Popup que recebemos tudo
        if (event.source && 'postMessage' in event.source) {
            (event.source as Window).postMessage('AUTH_ACKNOWLEDGED', { targetOrigin: '*' });
        }

        setError(null);
        setIsConnected(true);
        
        // Sincroniza imediatamente
        fetchFromDrive();
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
    userAccount,
    checkStatus,
    fetchFromDrive,
    syncToDrive,
    handleLogout,
    setError
  };
}
