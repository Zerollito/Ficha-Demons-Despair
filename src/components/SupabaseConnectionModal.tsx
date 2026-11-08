import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Laptop,
  Wifi,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Radio
} from "lucide-react";
import {
  getSupabaseConfig,
  setSupabaseConfig,
  testSupabaseConnection,
  fetchServerSupabaseConfig,
  STANDARD_LOCAL_ANON_KEY
} from "../lib/supabase";

interface SupabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSupabaseConnected: boolean;
  user?: any;
  onOpenAuthModal?: () => void;
}

export const SupabaseConnectionModal: React.FC<SupabaseConnectionModalProps> = ({
  isOpen,
  onClose,
  isSupabaseConnected,
  user,
  onOpenAuthModal
}) => {
  const [currentConfig, setCurrentConfig] = useState(getSupabaseConfig());
  const [urlInput, setUrlInput] = useState(currentConfig.url);
  const [keyInput, setKeyInput] = useState(currentConfig.anonKey);
  const [serverConfig, setServerConfig] = useState<{
    url: string;
    anonKey: string;
    source: string;
    isLocalhostTarget: boolean;
    updatedAt?: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'guide'>('status');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latency?: number;
  } | null>(null);

  const [copiedCommand, setCopiedCommand] = useState(false);

  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  );

  // Carrega configuração atual e status do servidor
  const refreshStatus = async () => {
    const config = getSupabaseConfig();
    setCurrentConfig(config);
    setUrlInput(config.url);
    setKeyInput(config.anonKey);

    const srv = await fetchServerSupabaseConfig();
    if (srv) {
      setServerConfig(srv);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async (urlToTest?: string, keyToTest?: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(urlToTest || urlInput, keyToTest || keyInput);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || "Erro desconhecido ao testar conexão."
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndSync = async () => {
    setIsSaving(true);
    try {
      const res = await setSupabaseConfig(urlInput, keyInput);
      setTestResult(res);
      await refreshStatus();
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || "Erro ao salvar nova configuração."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPreset = (presetType: 'pc_local' | 'mobile_proxy' | 'cloud') => {
    if (presetType === 'pc_local') {
      setUrlInput("http://127.0.0.1:54321");
      setKeyInput(STANDARD_LOCAL_ANON_KEY);
    } else if (presetType === 'mobile_proxy') {
      if (typeof window !== 'undefined') {
        setUrlInput(window.location.origin);
      } else {
        setUrlInput("http://127.0.0.1:3000");
      }
      setKeyInput(STANDARD_LOCAL_ANON_KEY);
    }
  };

  const handleCopyCommand = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 p-5 sm:p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-4 font-sans relative max-h-[92vh] overflow-y-auto custom-scrollbar"
        >
          {/* Botão Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Cabeçalho */}
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-zinc-100 uppercase tracking-tight">
                  Supabase & Conexão Mobile
                </h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isSupabaseConnected 
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  {isSupabaseConnected ? "Online" : "Offline / Cache"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Sincronização de fichas, VTT em tempo real e acesso via celular
              </p>
            </div>
          </div>

          {/* Abas */}
          <div className="grid grid-cols-3 gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'status' ? "bg-amber-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Radio size={14} />
              Status
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'config' ? "bg-amber-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Globe size={14} />
              Configurar URL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'guide' ? "bg-amber-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Smartphone size={14} />
              Guia Celular
            </button>
          </div>

          {/* TAB 1: STATUS E DIAGNÓSTICO */}
          {activeTab === 'status' && (
            <div className="space-y-4 pt-1">
              {/* Card de Status Geral */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Dispositivo Atual:</span>
                  <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    {isLocalHost ? <Laptop size={14} className="text-amber-500" /> : <Smartphone size={14} className="text-amber-500" />}
                    {isLocalHost ? "PC Host (Localhost)" : "Celular / Acesso Remoto"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">URL em Uso no App:</span>
                  <span className="text-xs font-mono font-bold text-amber-400 truncate max-w-[240px]">
                    {currentConfig.url}
                  </span>
                </div>

                {serverConfig && (
                  <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Alvo do Servidor Host:</span>
                    <span className="text-xs font-mono text-zinc-300 truncate max-w-[240px]">
                      {serverConfig.url}
                    </span>
                  </div>
                )}

                {user && (
                  <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Conta Autenticada:</span>
                    <span className="text-xs font-bold text-emerald-400 truncate max-w-[240px] flex items-center gap-1">
                      <ShieldCheck size={14} />
                      {user.email || user.displayName || "Usuário"}
                    </span>
                  </div>
                )}
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  testResult.success
                    ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                    : "bg-red-950/30 border-red-800/60 text-red-300"
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold">{testResult.message}</p>
                    {testResult.latency !== undefined && (
                      <p className="text-[11px] opacity-80 mt-0.5">Latência: {testResult.latency} ms</p>
                    )}
                  </div>
                </div>
              )}

              {/* Botões de Ação Rápida */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleTestConnection()}
                  disabled={isTesting}
                  className="flex-1 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-700"
                >
                  <RefreshCw size={14} className={isTesting ? "animate-spin text-amber-500" : "text-amber-500"} />
                  {isTesting ? "Testando Conexão..." : "Testar Conexão"}
                </button>

                {!user && onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuthModal();
                    }}
                    className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <ShieldCheck size={14} />
                    Fazer Login / Criar Conta
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURAÇÃO MANUAL */}
          {activeTab === 'config' && (
            <div className="space-y-4 pt-1">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Você pode apontar o app diretamente para o Supabase no PC, para um túnel do Cloudflare ou usar o proxy inteligente do servidor.
              </p>

              {/* Presets Rápidos */}
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  Atalhos de Configuração:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('mobile_proxy')}
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Smartphone size={14} /> Proxy Automático
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Ideal para celular (evita CORS e porta fechada)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('pc_local')}
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer"
                  >
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Laptop size={14} /> Supabase Local (PC)
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      http://127.0.0.1:54321
                    </span>
                  </button>
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">
                    URL do Supabase:
                  </label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="http://127.0.0.1:54321 ou https://túnel.trycloudflare.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                      Chave Anon Key (JWT):
                    </label>
                    <button
                      type="button"
                      onClick={() => setKeyInput(STANDARD_LOCAL_ANON_KEY)}
                      className="text-[10px] text-amber-500 hover:underline cursor-pointer"
                    >
                      Restaurar padrão local
                    </button>
                  </div>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs ${
                  testResult.success
                    ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                    : "bg-red-950/30 border-red-800/60 text-red-300"
                }`}>
                  {testResult.message}
                </div>
              )}

              {/* Botão Salvar e Sincronizar */}
              <button
                type="button"
                onClick={handleSaveAndSync}
                disabled={isSaving || !urlInput.trim()}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Salvando & Sincronizando...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Salvar e Conectar
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: GUIA PASSO A PASSO PARA CELULAR */}
          {activeTab === 'guide' && (
            <div className="space-y-4 pt-1 text-xs">
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Wifi size={16} />
                  <span>Método 1: Mesmo Wi-Fi (Mais Fácil)</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  1. Descubra o IP local do seu computador (no Windows, abra o cmd e digite <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300 font-mono">ipconfig</code> para ver o IPv4, ex: <code className="text-amber-300 font-mono">192.168.1.100</code>).
                </p>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  2. No navegador do seu celular, acesse <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300 font-mono">http://192.168.X.X:3000</code>.
                </p>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  O servidor Express já repassa automaticamente todas as requisições de autenticação e dados do celular para o Supabase no PC via Proxy.
                </p>
              </div>

              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Terminal size={16} />
                  <span>Método 2: Túnel Gratuito (Cloudflare Tunnel)</span>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  Se você estiver usando 4G/5G no celular ou estiver fora de casa, crie um túnel gratuito para o Supabase no PC:
                </p>

                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300 flex items-center justify-between">
                  <span className="truncate mr-2">npx cloudflared tunnel --url http://localhost:54321</span>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand("npx cloudflared tunnel --url http://localhost:54321")}
                    className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copiar comando"
                  >
                    {copiedCommand ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Copie a URL gerada (ex: <code className="text-amber-400 font-mono">https://xxxx.trycloudflare.com</code>) e cole na aba <strong>Configurar URL</strong> acima. Pronto! O celular e o PC sincronizam na hora.
                </p>
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="flex justify-end pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-zinc-800"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
