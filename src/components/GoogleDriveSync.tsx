import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud as CloudIcon, CloudOff as CloudOffIcon, RefreshCw as RefreshCwIcon, LogIn, LogOut, CheckCircle2, AlertCircle, ChevronDown, FolderOpen } from 'lucide-react';
import { DriveExplorer } from './DriveExplorer';
import { CloudFileSelector } from './CloudFileSelector';

interface GoogleDriveSyncProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
  userAccount?: string | null;
  fileName?: string;
  folderName?: string;
  onSync: () => void;
  onFetch: () => void;
  onDownloadFile?: (fileId: string) => void;
  onLogout: () => void;
  onConnect: (useRedirect?: boolean) => void;
  onFileNameChange?: (name: string) => void;
  onFolderNameChange?: (name: string) => void;
  onFolderIdChange?: (id: string) => void;
  onPickerOpen?: () => void;
  onCheckStatus?: () => void;
  listFolders: (parentId?: string) => Promise<any[]>;
  listFiles: (folderId?: string) => Promise<any[]>;
  variant?: 'full' | 'menu';
}

export function GoogleDriveSync({ 
  isConnected, 
  isSyncing, 
  lastSync, 
  error, 
  userAccount,
  fileName = 'rpg_demons_despair.json',
  folderName,
  onSync, 
  onFetch, 
  onDownloadFile,
  onLogout, 
  onConnect,
  onFileNameChange,
  onFolderNameChange,
  onFolderIdChange,
  onPickerOpen,
  onCheckStatus,
  listFolders,
  listFiles,
  variant = 'full' 
}: GoogleDriveSyncProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(fileName);
  const [tempFolder, setTempFolder] = useState(folderName || '');

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

  // Content for the logout modal - extracted to be reusable
  const logoutModal = (
    <AnimatePresence>
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-sm w-full shadow-2xl text-center"
          >
            <div className="flex justify-center mb-6">
                <div className="p-4 bg-red-500/10 rounded-2xl text-red-500">
                    <LogOut size={32} />
                </div>
            </div>
            
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Desconectar?</h3>
            <p className="text-zinc-500 text-sm mb-8 font-medium leading-relaxed">
              Deseja desconectar sua conta do Google Drive? 
              Seus saves em nuvem continuarão seguros, mas a sincronização automática será pausada.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all text-xs font-black uppercase tracking-widest text-zinc-400"
              >
                Cancelar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    onLogout();
                    setShowLogoutConfirm(false);
                }}
                className="py-3 bg-red-600 hover:bg-red-500 rounded-xl transition-all text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20"
              >
                Sair
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Menu variant renders as a button for the dropdown
  if (variant === 'menu') {
    return (
      <>
        {!isConnected ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onConnect()}
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

        {logoutModal}
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
           <div className="flex flex-col items-end gap-1">
             <div className="inline-flex items-center self-start sm:self-auto gap-1.5 text-emerald-500 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizado
             </div>
             {lastSync && (
                <span className="text-[9px] text-zinc-500 font-medium">
                    Última vez: {lastSync}
                </span>
             )}
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
              onClick={() => setShowFileSelector(true)}
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
              onClick={() => onConnect(false)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/10 transition-colors"
            >
              <LogIn size={14} /> Vincular Google Drive
            </motion.button>
            
            <p className="text-[10px] text-zinc-500 text-center px-2 mt-1 italic">
                Sincronização via Pop-up (Requer Janela Isolada).
            </p>

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
        <div className="mt-4 pt-3 border-t border-zinc-800/50 space-y-3">
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
            </div>
          )}

          {/* Seletor de Nome de Arquivo (V5.4) */}
          <div className="p-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl">
             <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Identidade do Backup</span>
                {!isEditingName ? (
                    <button 
                        onClick={() => {
                            setTempName(fileName);
                            setTempFolder(folderName || '');
                            setIsEditingName(true);
                        }}
                        className="text-[9px] text-amber-500 hover:text-amber-400 font-bold uppercase"
                    >
                        Configurar Local
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsEditingName(false)}
                            className="text-[9px] text-zinc-500 hover:text-zinc-400 font-bold uppercase"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => {
                                if (tempName.trim()) {
                                    onFileNameChange?.(tempName.trim().endsWith('.json') ? tempName.trim() : tempName.trim() + '.json');
                                    onFolderNameChange?.(tempFolder.trim() || '');
                                    setIsEditingName(false);
                                }
                            }}
                            className="text-[9px] text-emerald-500 hover:text-emerald-400 font-bold uppercase"
                        >
                            Salvar
                        </button>
                    </div>
                )}
             </div>

             {isEditingName ? (
                 <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[8px] text-zinc-600 uppercase font-bold">Pasta no Google Drive</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowExplorer(true)}
                                    className="text-[8px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-tighter flex items-center gap-1"
                                >
                                    <FolderOpen size={10} /> Explorer
                                </button>
                                {onPickerOpen && (
                                    <button 
                                        onClick={onPickerOpen}
                                        className="text-[8px] text-zinc-500 hover:text-zinc-400 font-black uppercase tracking-tighter"
                                    >
                                        Picker
                                    </button>
                                )}
                            </div>
                        </div>
                        <input 
                            type="text"
                            value={tempFolder}
                            onChange={(e) => setTempFolder(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 font-bold focus:outline-none focus:border-amber-500/50"
                            placeholder="Ex: Campanhas_RPG"
                        />
                    </div>
                    <div>
                        <label className="text-[8px] text-zinc-600 uppercase font-bold mb-1 block">Nome do Arquivo</label>
                        <input 
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 font-bold focus:outline-none focus:border-amber-500/50"
                            placeholder="nome_do_arquivo.json"
                        />
                    </div>
                 </div>
             ) : (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span className="text-[8px] uppercase font-bold text-zinc-600 w-10">Pasta:</span>
                        <span className="font-bold truncate">{folderName || 'Raiz do Drive'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-bold">
                        <span className="text-[8px] uppercase font-bold text-zinc-600 w-10">Arquivo:</span>
                        <span className="truncate">{fileName}</span>
                    </div>
                </div>
             )}
             <p className="text-[8px] text-zinc-600 mt-2.5 italic leading-tight">
                {isEditingName ? "O app criará a pasta automaticamente se ela não existir." : "Dica: Organize seus personagens em pastas diferentes."}
             </p>
          </div>
        </div>
      )}

      {/* Navegador de Pastas */}
      <AnimatePresence>
        {showExplorer && (
          <DriveExplorer
            isOpen={showExplorer}
            onClose={() => setShowExplorer(false)}
            listFolders={listFolders}
            onSelect={(folder) => {
              setTempFolder(folder.name);
              onFolderNameChange?.(folder.name);
              onFolderIdChange?.(folder.id);
              setShowExplorer(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Seletor de Arquivos para Download */}
      <AnimatePresence>
        {showFileSelector && (
          <CloudFileSelector
            isOpen={showFileSelector}
            onClose={() => setShowFileSelector(false)}
            listFiles={listFiles}
            currentFolderName={folderName}
            onSelect={(fileId) => {
                onDownloadFile?.(fileId);
                setShowFileSelector(false);
            }}
          />
        )}
      </AnimatePresence>

      {logoutModal}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
