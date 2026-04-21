import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CloudOff, RefreshCw, LogIn, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

interface GoogleDriveSyncProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
  onSync: () => void;
  onFetch: () => void;
  onLogout: () => void;
  onConnect: () => void;
  variant?: 'full' | 'menu';
}

export function GoogleDriveSync({ 
  isConnected, 
  isSyncing, 
  lastSync, 
  error, 
  onSync, 
  onFetch, 
  onLogout, 
  onConnect,
  variant = 'full' 
}: GoogleDriveSyncProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded text-xs font-bold transition-colors border border-zinc-700"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            Salvar
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onFetch}
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
          onClick={onConnect}
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
