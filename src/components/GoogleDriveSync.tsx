import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud as CloudIcon, CloudOff as CloudOffIcon, RefreshCw as RefreshCwIcon, LogIn, LogOut, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';

interface GoogleDriveSyncProps {
  isConnected: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
  userAccount?: string | null;
  origin?: string;
  fileName?: string;
  folderName?: string;
  onSync: () => void;
  onFetch: () => void;
  onLogout: () => void;
  onConnect: (useRedirect?: boolean) => void;
  onFileNameChange?: (name: string) => void;
  onFolderNameChange?: (name: string) => void;
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
  fileName = 'rpg_demons_despair.json',
  folderName,
  onSync, 
  onFetch, 
  onLogout, 
  onConnect,
  onFileNameChange,
  onFolderNameChange,
  onCheckStatus,
  variant = 'full' 
}: GoogleDriveSyncProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
                <span className="text-[8px] bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded leading-none">V5.9</span>
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

      <div className="mt-4 pt-3 border-t border-zinc-800/20">
        <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest group-open:text-amber-500 transition-colors">
                    Configurações do Google Cloud
                </span>
                <div className="text-zinc-700 group-open:rotate-180 transition-transform">
                    <ChevronDown size={12} />
                </div>
            </summary>
            
            <div className="mt-3 space-y-3 p-3 bg-zinc-950/30 rounded-xl border border-zinc-800/30">
                <p className="text-[9px] text-zinc-500 leading-tight">
                    Se você encontrar erros <span className="text-amber-500 font-bold">403</span> ou <span className="text-red-500 font-bold">400</span>, certifique-se de que as URLs abaixo estão cadastradas no seu <span className="text-zinc-300">Console do Google Cloud &gt; APIs &gt; Credenciais &gt; ID do Cliente OAuth 2.0</span>.
                </p>

                <div className="space-y-2">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">Origens JavaScript</span>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin);
                                    alert("Origem copiada!");
                                }}
                                className="text-[8px] text-amber-500 font-bold hover:underline"
                            >
                                COPIAR
                            </button>
                        </div>
                        <div className="p-2 bg-zinc-950/50 rounded border border-zinc-800 font-mono text-[9px] break-all text-zinc-400">
                            {window.location.origin}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">URIs de Redirecionamento</span>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin + window.location.pathname);
                                    alert("URI de Redirecionamento copiada!");
                                }}
                                className="text-[8px] text-amber-500 font-bold hover:underline"
                            >
                                COPIAR
                            </button>
                        </div>
                        <div className="p-2 bg-zinc-950/50 rounded border border-zinc-800 font-mono text-[9px] break-all text-zinc-400">
                            {window.location.origin + window.location.pathname}
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/30 space-y-2">
                    <button 
                        onClick={() => onConnect(true)}
                        className="w-full py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase rounded hover:bg-blue-500/20 transition-all"
                    >
                        Forçar Modo Redirecionamento (Expert)
                    </button>
                    <button 
                        onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
                        className="w-full py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase rounded hover:bg-amber-500/20 transition-all"
                    >
                        Abrir em Janela Isolada
                    </button>
                    <p className="text-[7px] text-zinc-600 mt-1 italic text-center uppercase">Use a janela isolada para permitir o pop-up do Google</p>
                </div>
            </div>
        </details>
      </div>

      {(lastSync || error) && (
        <div className="mt-4 pt-3 border-t border-zinc-800/50 space-y-3">
          {error ? (
            <div className="flex flex-col gap-2 bg-red-400/5 p-3 rounded-xl border border-red-400/20">
              <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold">
                <AlertCircle size={14} /> 
                <span>{error}</span>
              </div>
              
              {error.includes('403') && (
                <div className="mt-2 space-y-2">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-[9px] text-amber-400 leading-tight font-medium">
                            <span className="font-black">ERRO 403 (ORIGEM):</span> O Google bloqueia login em URLs de "Preview" que não foram cadastradas no seu Console do GCP.
                        </p>
                    </div>
                    
                    <div className="space-y-1">
                        <p className="text-[8px] text-zinc-500 uppercase font-bold px-1">Copie para 'Origens JavaScript':</p>
                        <div className="flex gap-1">
                            <div className="flex-1 p-2 bg-zinc-950 rounded border border-zinc-800 font-mono text-[9px] break-all text-amber-500 select-all overflow-hidden whitespace-nowrap text-ellipsis">
                                {window.location.origin}
                            </div>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin);
                                    alert("URL de Origem Copiada!");
                                }}
                                className="px-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <span className="text-[8px] font-bold uppercase">Copiar</span>
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="w-full py-2.5 bg-amber-500 text-zinc-950 text-[10px] font-black uppercase rounded-lg hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/10 active:scale-95"
                    >
                        Tentar em Janela Isolada
                    </button>
                </div>
              )}

              {error.includes('400') && (
                <div className="mt-2 space-y-2">
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-[9px] text-red-400 leading-tight font-medium">
                            <span className="font-black">ERRO 400 (REDIRECT_URI_MISMATCH):</span> O Google exige que o Redirecionamento seja IDÊNTICO ao cadastrado (incluindo barras finais).
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[8px] text-zinc-500 uppercase font-bold px-1">URI EXATA PARA O CONSOLE:</p>
                        <div className="flex gap-1">
                            <div className="flex-1 p-2 bg-zinc-950 rounded border border-zinc-800 font-mono text-[9px] break-all text-red-500 select-all overflow-hidden">
                                {window.location.origin + window.location.pathname}
                            </div>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin + window.location.pathname);
                                    alert("Copiado! Certifique-se de colar na seção 'URIs de Redirecionamento' do seu console GCP.");
                                }}
                                className="px-2 bg-zinc-800 rounded border border-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <span className="text-[8px] font-bold uppercase">Copiar</span>
                            </button>
                        </div>
                    </div>
                </div>
              )}
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
                        <label className="text-[8px] text-zinc-600 uppercase font-bold mb-1 block">Pasta (Opcional)</label>
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
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
