import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileCode, Calendar, ChevronRight, X, Loader2, Download, Search } from 'lucide-react';

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface CloudFileSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fileId: string) => void;
  listFiles: () => Promise<DriveFile[]>;
  currentFolderName?: string;
}

export function CloudFileSelector({ isOpen, onClose, onSelect, listFiles, currentFolderName }: CloudFileSelectorProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setIsLoading(true);
    const result = await listFiles();
    setFiles(result);
    setIsLoading(false);
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Baixar da Nuvem</h3>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                {currentFolderName ? `Na pasta: ${currentFolderName}` : 'Google Drive'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 bg-zinc-950/50 border-b border-zinc-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input 
              type="text"
              placeholder="Buscar backup pelo nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Buscando Backups...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20 text-zinc-600">
              <FileCode size={48} className="opacity-20" />
              <p className="text-xs font-medium">Nenhum arquivo JSON encontrado.</p>
              <button 
                onClick={loadFiles} 
                className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2 px-4 py-2 border border-blue-500/20 rounded-lg hover:bg-blue-500/5 transition-colors"
              >
                Recarregar
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFiles.map(file => (
                <button 
                  key={file.id}
                  onClick={() => onSelect(file.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-zinc-500 group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-colors">
                      <FileCode size={18} />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-zinc-300 group-hover:text-zinc-100 block truncate max-w-[240px]">
                        {file.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                        <Calendar size={10} />
                        <span>Modificado em: {formatDate(file.modifiedTime)}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-center">
            <p className="text-[10px] text-zinc-500 font-medium italic">
                Escolha um arquivo para substituir seu progresso atual.
            </p>
        </div>
      </motion.div>
    </div>
  );
}
