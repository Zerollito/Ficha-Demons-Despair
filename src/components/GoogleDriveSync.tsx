import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CloudOff, RefreshCw, LogIn, LogOut, CheckCircle2, AlertCircle, Trash2, X } from 'lucide-react';
import { AppState } from '../types';

interface GoogleDriveSyncProps {
  appState: AppState;
  onStateUpdate: (newState: AppState) => void;
  variant?: 'full' | 'menu';
}

export function GoogleDriveSync({ appState, onStateUpdate, variant = 'full' }: GoogleDriveSyncProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/drive/status');
      const data = await res.json();
      setIsConnected(data.connected);
    } catch (err) {
      console.error("Status check failed", err);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsConnected(true);
        fetchFromDrive(); // Auto fetch after login
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    setError(null);
    
    // Abrir janela primeiro para evitar bloqueio de popup pelo navegador (importante após ação do usuário)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const authWindow = window.open(
      'about:blank',
      'google_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (authWindow) {
      authWindow.document.write('<p style="font-family:sans-serif; text-align:center; margin-top:20px;">Carregando autenticação do Google...</p>');
    } else {
      setError("O navegador bloqueou o pop-up. Por favor, permita pop-ups para este site.");
      return;
    }

    try {
      const res = await fetch('/api/auth/google/url');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao obter URL");
      }
      const { url } = await res.json();
      
      authWindow.location.href = url;
    } catch (err: any) {
      setError(err.message || "Falha ao iniciar autenticação");
      authWindow.close();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsConnected(false);
      setLastSync(null);
      setShowLogoutConfirm(false);
    } catch (err) {
      setError("Falha ao deslogar");
    }
  };

  const syncToDrive = async () => {
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
      setError("Erro ao sincronizar");
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchFromDrive = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/fetch');
      const { data } = await res.json();
      if (data) {
        onStateUpdate(data);
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (err) {
      setError("Erro ao buscar dados");
    } finally {
      setIsSyncing(false);
    }
  };

  // Menu variant renders as a button for the dropdown
  if (variant === 'menu') {
    return (
      <>
        {!isConnected ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
          >
            <Cloud size={18} className="text-amber-500" /> Vincular Google Drive
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-emerald-400"
          >
            <CheckCircle2 size={18} /> Google Drive Conectado
          </motion.button>
        )}

        {/* Logout Confirmation Modal */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl max-w-sm w-full shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                  <Cloud size={24} />
                  <h3 className="text-lg font-bold">Google Drive</h3>
                </div>
                
                <p className="text-zinc-400 text-sm mb-6">
                  Deseja desconectar sua conta do Google Drive? 
                  A sincronização em nuvem será desativada.
                </p>

                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium text-zinc-300"
                  >
                    Manter
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm font-medium text-white"
                  >
                    Desconectar
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
          )}>
            {isConnected ? <Cloud size={20} /> : <CloudOff size={20} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Sincronização Nuvem</h3>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
              Google Drive
            </p>
          </div>
        </div>

        {isConnected && (
           <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 size={12} /> Ativa
           </div>
        )}
      </div>

      {isConnected ? (
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={syncToDrive}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-xs font-bold transition-colors border border-zinc-700"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            Salvar
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fetchFromDrive}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-xs font-bold transition-colors border border-zinc-700"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            Carregar
          </motion.button>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleConnect}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded text-xs font-bold transition-colors"
        >
          <LogIn size={14} /> Vincular Conta Google
        </motion.button>
      )}

      {(lastSync || error) && (
        <div className="mt-3 flex items-center justify-between px-1 border-t border-zinc-800 pt-3">
          {error ? (
            <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold">
              <AlertCircle size={12} /> {error}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold">
              Última sincronização: {lastSync}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
