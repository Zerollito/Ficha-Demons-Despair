import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  X, 
  Server, 
  Key, 
  ExternalLink, 
  Copy, 
  RotateCcw, 
  ShieldCheck, 
  Radio, 
  LogOut, 
  User as UserIcon,
  HardDrive
} from "lucide-react";
import { 
  getSupabaseConfig, 
  setSupabaseConfig, 
  testSupabaseConnection, 
  rescueAllLocalCharacters,
  syncLocalToCloud,
  logout
} from "../lib/supabase";

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any | null;
  isOnline: boolean;
  isSupabaseConnected: boolean;
  dirtyCount: number;
  syncError?: string | null;
  showToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  onOpenAuthModal: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isOnline,
  isSupabaseConnected,
  dirtyCount,
  syncError,
  showToast,
  onOpenAuthModal,
}) => {
  const [urlInput, setUrlInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrlInput(cfg.url || "http://127.0.0.1:54321");
      setKeyInput(cfg.anonKey || "");
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(urlInput, keyInput);
      setTestResult(res);
      if (res.success) {
        showToast(res.message, "success");
      } else {
        showToast(res.message, "warning");
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Erro de rede ao testar." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await setSupabaseConfig(urlInput, keyInput);
      setTestResult(res);
      if (res.success) {
        showToast("Configuração salva e conectado com sucesso!", "success");
        setTimeout(() => onClose(), 600);
      } else {
        showToast("Configuração salva, mas o Supabase não respondeu imediatamente. Operando em modo cache local.", "warning");
      }
    } catch (err: any) {
      showToast("Erro ao salvar configuração: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaultLocal = () => {
    setUrlInput("http://127.0.0.1:54321");
    setKeyInput("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNRebZhBc_4bXn6U");
    setTestResult(null);
    showToast("Restaurado para padrão Supabase Local (127.0.0.1:54321).", "info");
  };

  const handleUseProxyOrigin = () => {
    if (typeof window !== 'undefined') {
      setUrlInput(window.location.origin);
      setTestResult(null);
      showToast("Alvo alterado para o proxy deste servidor.", "info");
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncLocalToCloud();
      showToast("Sincronização executada com sucesso!", "success");
    } catch (e: any) {
      showToast("Sincronização concluída no armazenamento local.", "info");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRescue = () => {
    try {
      const restored = rescueAllLocalCharacters();
      showToast(`${restored.length} fichas restauradas do navegador com sucesso!`, "success");
    } catch (e: any) {
      showToast("Erro ao restaurar fichas: " + e.message, "error");
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 p-5 sm:p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-5 font-sans relative max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-500 uppercase tracking-wider flex items-center gap-2">
                Conexão Supabase / Banco de Dados
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Gerencie o alvo de banco de dados e a sincronização de fichas.
              </p>
            </div>
          </div>

          {/* Real-time Status Card */}
          <div className={`p-4 rounded-xl border flex flex-col gap-2.5 transition-all ${
            !isOnline || !currentUser
              ? "bg-amber-950/20 border-amber-500/40 text-amber-400"
              : isSupabaseConnected
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400"
                : "bg-blue-950/20 border-blue-500/40 text-blue-400"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                {!isOnline ? (
                  <>
                    <WifiOff size={16} className="text-amber-400" />
                    <span>Dispositivo Desconectado (Sem Internet)</span>
                  </>
                ) : !currentUser ? (
                  <>
                    <UserIcon size={16} className="text-amber-400" />
                    <span>Não Autenticado (Modo Convidado)</span>
                  </>
                ) : isSupabaseConnected ? (
                  <>
                    <Wifi size={16} className="text-emerald-400" />
                    <span>Conectado com Supabase / Sincronizado</span>
                  </>
                ) : (
                  <>
                    <Database size={16} className="text-blue-400" />
                    <span>Conectado ao app / Modo offline (Sem acesso ao Supabase local)</span>
                  </>
                )}
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-current">
                {!isOnline ? "DESCONECTADO" : !currentUser ? "NÃO AUTENTICADO" : isSupabaseConnected ? "CONECTADO" : "MODO OFFLINE"}
              </span>
            </div>

            {syncError && (
              <div className="text-[11px] bg-red-950/40 border border-red-500/30 text-red-300 p-2 rounded-lg">
                <span className="font-bold">Aviso: </span>{syncError}
              </div>
            )}

            {!currentUser && (
              <div className="flex items-center justify-between text-[11px] bg-zinc-950/60 border border-zinc-800 p-2.5 rounded-lg text-zinc-400">
                <span>Você não está logado. Suas fichas estão salvas apenas neste navegador.</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuthModal();
                  }}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded text-[10px] uppercase tracking-wider shrink-0 ml-2"
                >
                  Entrar
                </button>
              </div>
            )}

            <div className="text-[11px] text-zinc-300 space-y-1 bg-black/30 p-2.5 rounded-lg border border-zinc-800/60 font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Usuário:</span>
                <span className="text-zinc-200 font-bold">{currentUser?.email || "Visitante / Convidado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Alvo Ativo:</span>
                <span className="text-zinc-300 truncate max-w-[240px]">{urlInput}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Fichas com alteração pendente:</span>
                <span className={`font-black ${dirtyCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {dirtyCount} {dirtyCount === 1 ? "ficha" : "fichas"}
                </span>
              </div>
            </div>
          </div>

          {/* Test Result Feedback */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              {testResult.success ? <Check size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
              <span className="flex-1">{testResult.message}</span>
            </div>
          )}

          {/* URL & Key Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Server size={14} className="text-amber-500" /> URL do Supabase
                </span>
                <span className="text-[9px] text-zinc-500 lowercase">ex: http://127.0.0.1:54321 ou túnel https://...</span>
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://127.0.0.1:54321"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" /> Chave Pública Anon (JWT)
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono transition-colors"
              />
            </div>

            {/* Quick URL Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleResetDefaultLocal}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} /> Padrão Local (127.0.0.1:54321)
              </button>
              <button
                type="button"
                onClick={handleUseProxyOrigin}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
              >
                <Server size={11} /> Usar Proxy Deste App
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
              {isTesting ? "Testando..." : "Testar Conexão"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="py-2.5 bg-amber-600 hover:bg-amber-500 text-black border border-amber-400/40 rounded-xl text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-600/20 disabled:opacity-50"
            >
              <Check size={15} />
              {isSaving ? "Salvando..." : "Salvar e Conectar"}
            </button>
          </div>

          {/* Sync & Rescue Section */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Operações de Fichas e Armazenamento
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
              </button>

              <button
                type="button"
                onClick={handleRescue}
                className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                title="Restaura fichas salvas em IndexedDB ou localStorage neste navegador"
              >
                <HardDrive size={13} />
                Restaurar do Navegador
              </button>
            </div>
          </div>

          {/* User Account / Auth Section */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
            {currentUser ? (
              <>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <UserIcon size={14} className="text-amber-500" />
                  <span className="truncate max-w-[200px]">{currentUser.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Deseja realmente sair da conta?")) {
                      logout();
                      showToast("Você saiu da conta.", "info");
                      onClose();
                    }
                  }}
                  className="py-1.5 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <LogOut size={13} />
                  Sair da Conta
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
                className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserIcon size={14} />
                Entrar ou Criar Conta
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
