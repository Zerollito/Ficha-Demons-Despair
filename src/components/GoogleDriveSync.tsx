import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud as CloudIcon, CloudOff as CloudOffIcon, RefreshCw as RefreshCwIcon, LogIn, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

interface GoogleDriveSyncProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
  userAccount?: string | null;
  origin?: string;
  onSync: () => void;
  onFetch: () => void;
  onLogout: () => void;
  onConnect: (useRedirect?: boolean) => void;
  onCheckStatus?: () => void;
  variant?: 'full' | 'menu';
}

export function GoogleDriveSync({ 
  isConnected, 
  isSyncing, 
  lastSync, 
  error, 
  userAccount,
  origin,
  onSync, 
  onFetch, 
  onLogout, 
  onConnect,
  onCheckStatus,
  variant = 'full' 
}: GoogleDriveSyncProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleHardReset = async () => {
    if (confirm("Isso irá limpar o cache do app e recarregar. Deseja continuar?")) {
        try {
            // Limpa Caches
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(key => caches.delete(key)));
            
            // Unregister Service Workers
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
            
            // Recarrega do servidor
            window.location.reload();
        } catch (e) {
            window.location.reload();
        }
    }
  };

  // Menu variant renders as a button for the dropdown
  if (variant === 'menu') {
    return (
      <>
        {!isConnected ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onConnect}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
          >
            <CloudIcon size={18} className={error ? "text-red-500" : "text-amber-500"} /> 
            {error ? "Erro na Conexão" : "Vincular Google Drive"}
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

        {error && !isConnected && (
          <div className="flex flex-col gap-1 mt-1">
            {onCheckStatus && (
                <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onCheckStatus}
                className="w-full flex items-center gap-3 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors text-[10px] font-bold text-emerald-400"
                >
                <CheckCircle2 size={14} /> Já fiz o Login (Verificar)
                </motion.button>
            )}
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleHardReset}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors text-[10px] font-bold text-red-400"
            >
                <RefreshCwIcon size={14} /> Corrigir Erro de Cache
            </motion.button>
          </div>
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
                  <CloudIcon size={24} />
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
                    onClick={() => {
                        onLogout();
                        setShowLogoutConfirm(false);
                    }}
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
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6 relative overflow-hidden">
      {isSyncing && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <RefreshCwIcon size={24} className="text-emerald-500 animate-spin" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            isConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
          )}>
            {isConnected ? <CloudIcon size={20} /> : <CloudOffIcon size={20} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Backup na Nuvem
            </h3>
            <div className="flex flex-col">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-none">
                Google Drive
                </p>
                {isConnected && userAccount && (
                    <span className="text-[9px] text-emerald-400/70 font-medium truncate max-w-[150px]">
                        {userAccount}
                    </span>
                )}
            </div>
          </div>
        </div>

        {isConnected && (
           <div className="inline-flex items-center self-start sm:self-auto gap-1.5 text-emerald-500 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado
           </div>
        )}
      </div>

      {isConnected ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onSync}
              disabled={isSyncing}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-zinc-800 hover:bg-emerald-600/10 hover:border-emerald-500/30 disabled:opacity-50 text-zinc-300 hover:text-emerald-400 rounded-lg text-xs font-bold transition-all border border-zinc-700"
            >
              <CloudIcon size={16} />
              Enviar para Nuvem
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onFetch}
              disabled={isSyncing}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-zinc-800 hover:bg-blue-600/10 hover:border-blue-500/30 disabled:opacity-50 text-zinc-300 hover:text-blue-400 rounded-lg text-xs font-bold transition-all border border-zinc-700"
            >
              <RefreshCwIcon size={16} />
              Baixar da Nuvem
            </motion.button>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-1.5 text-red-400/50 hover:text-red-400 text-[10px] font-bold uppercase tracking-tighter"
          >
            Desconectar Conta
          </motion.button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onConnect(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/10 transition-colors"
            >
              <LogIn size={14} /> Vincular Google Drive
            </motion.button>
            
            <p className="text-[10px] text-zinc-500 text-center px-2 mt-1 italic">
                Recomendado para Celular/App.
            </p>

            <div className="h-px bg-zinc-800 my-1" />

            <button
               onClick={() => onConnect(false)}
               className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors uppercase font-bold tracking-tighter"
            >
                Usar Modo Popup (Apenas Desktop)
            </button>

            {origin && !isConnected && (
                <div className="mt-2 p-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1 text-center font-mono">
                        {origin}
                    </p>
                    <p className="text-[8px] text-zinc-600 text-center italic leading-none">
                        Origem Detectada (Whitelist no Google)
                    </p>
                </div>
            )}

            {!isConnected && onCheckStatus && (
                <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onCheckStatus}
                className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-medium transition-colors border border-zinc-700"
                >
                <CheckCircle2 size={12} /> Já autorizei o acesso (Entrar)
                </motion.button>
            )}
        </div>
      )}

      {(lastSync || error) && (
        <div className="mt-4 pt-3 border-t border-zinc-800/50">
          {error ? (
            <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold bg-red-400/5 p-2 rounded border border-red-400/10">
              <AlertCircle size={14} /> 
              <span>{error}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                  <span>Último Backup</span>
                  <span className="text-zinc-400">{lastSync}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 italic">
                  <CheckCircle2 size={10} /> Arquivo: rpg_demons_despair.json
                </div>
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
