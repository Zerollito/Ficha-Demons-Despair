import { useState, useEffect, useCallback } from 'react';
import { AppState } from '../types';

export function useGoogleDrive(appState: AppState, onStateUpdate: (newState: AppState) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async (retryCount = 0): Promise<boolean> => {
    try {
      const res = await fetch('/api/drive/status');
      const data = await res.json();
      setIsConnected(data.connected);
      if (data.connected) setError(null); // Limpa erro se conectar com sucesso
      return data.connected;
    } catch (err) {
      console.error("Status check failed", err);
      // Tenta novamente até 3 vezes se falhar (útil para lentidão de rede)
      if (retryCount < 3) {
        await new Promise(r => setTimeout(r, 1000));
        return checkStatus(retryCount + 1);
      }
      return false;
    }
  }, []);

  const fetchFromDrive = useCallback(async (retryCount = 0) => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/fetch');
      if (res.status === 401) {
        setIsConnected(false);
        // Se acabamos de logar, talvez a sessão ainda não propagou. Tenta de novo.
        if (retryCount < 2) {
            await new Promise(r => setTimeout(r, 1500));
            return fetchFromDrive(retryCount + 1);
        }
        throw new Error("Sua sessão expirou. Por favor, conecte novamente.");
      }
      if (!res.ok) throw new Error("Não foi possível baixar os dados da nuvem.");
      
      const { data } = await res.json();
      if (data) {
        onStateUpdate(data);
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o Drive.");
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  }, [onStateUpdate]);

  const syncToDrive = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: appState })
      });
      if (!res.ok) throw new Error("Sync failed");
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      setError("Erro ao salvar na nuvem.");
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  }, [appState]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsConnected(false);
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
            // Delay mais generoso para Cloudflare e sessões lentas
            setTimeout(() => {
              checkStatus().then(connected => {
                  if (connected) fetchFromDrive();
              });
            }, 1500);
        }
    }, 1000);

    const handleMessage = (event: MessageEvent) => {
      // Aceitar mensagens de qualquer origem por conta do proxy/iframe
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log("OAuth Sucesso recebido via postMessage!");
        setIsConnected(true);
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
    checkStatus,
    fetchFromDrive,
    syncToDrive,
    handleLogout,
    setError
  };
}
