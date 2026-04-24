import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, ChevronRight, ChevronLeft, Check, X, Loader2, Home } from 'lucide-react';

interface FolderItem {
  id: string;
  name: string;
}

interface DriveExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folder: FolderItem) => void;
  listFolders: (parentId?: string) => Promise<FolderItem[]>;
}

export function DriveExplorer({ isOpen, onClose, onSelect, listFolders }: DriveExplorerProps) {
  const [currentPath, setCurrentPath] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'Meu Drive' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);

  const currentFolder = currentPath[currentPath.length - 1];

  const loadFolders = async (id: string) => {
    setIsLoading(true);
    const result = await listFolders(id);
    setFolders(result);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadFolders(currentFolder.id);
    }
  }, [isOpen, currentFolder.id]);

  const handleNavigate = (folder: FolderItem) => {
    setCurrentPath([...currentPath, folder]);
    setSelectedFolder(null);
  };

  const handleBack = () => {
    if (currentPath.length > 1) {
      const newPath = [...currentPath];
      newPath.pop();
      setCurrentPath(newPath);
      setSelectedFolder(null);
    }
  };

  const handleSelect = () => {
    if (selectedFolder) {
      onSelect(selectedFolder);
      onClose();
    } else {
        // Se nenhuma pasta selecionada, mas estamos em uma subpasta, seleciona a atual
        onSelect(currentFolder);
        onClose();
    }
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
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Folder size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Selecionar Pasta</h3>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Google Drive Explorer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Path Navigation */}
        <div className="px-4 py-2 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {currentPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              {index > 0 && <ChevronRight size={12} className="text-zinc-700 shrink-0" />}
              <button
                onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                className={`text-[10px] font-bold whitespace-nowrap px-2 py-1 rounded-md transition-colors ${
                  index === currentPath.length - 1 ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {folder.name === 'root' ? <Home size={12} /> : folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* List Areas */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 size={32} className="text-amber-500 animate-spin" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Carregando Pastas...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20 text-zinc-600">
              <Folder size={48} className="opacity-20" />
              <p className="text-xs font-medium">Nenhuma subpasta encontrada aqui.</p>
              {currentPath.length > 1 && (
                <button onClick={handleBack} className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-2 px-4 py-2 border border-amber-500/20 rounded-lg hover:bg-amber-500/5 transition-colors">
                  Voltar
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map(folder => (
                <div 
                  key={folder.id}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group ${
                    selectedFolder?.id === folder.id ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-zinc-800 border border-transparent'
                  }`}
                  onClick={() => setSelectedFolder(folder)}
                  onDoubleClick={() => handleNavigate(folder)}
                >
                  <div className="flex items-center gap-3">
                    <Folder size={20} className={selectedFolder?.id === folder.id ? 'text-amber-500' : 'text-zinc-500 group-hover:text-amber-400'} />
                    <span className={`text-sm font-bold truncate max-w-[200px] ${selectedFolder?.id === folder.id ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                      {folder.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate(folder);
                      }}
                      className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-600 hover:text-amber-400 transition-colors"
                      title="Abrir Pasta"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
          >
            Fechar Explorer
          </button>
          <button
            onClick={handleSelect}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              selectedFolder || currentPath.length > 0 
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20' 
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Check size={16} />
            Selecionar {selectedFolder ? 'Esta Pasta' : 'Pasta Atual'}
          </button>
        </div>
        
        {/* Hint */}
        <div className="px-4 pb-4 text-center">
            <p className="text-[9px] text-zinc-500 italic">
                {selectedFolder 
                    ? `Dica: Clique duas vezes na pasta "${selectedFolder.name}" para entrar nela.` 
                    : "Toque em uma pasta para selecionar ou na seta para entrar."}
            </p>
        </div>
      </motion.div>
    </div>
  );
}
