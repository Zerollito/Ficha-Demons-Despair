import React from 'react';

export const PrintSheetModal: React.FC<any> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full text-zinc-300">
        <h3 className="text-lg font-bold text-amber-500 mb-2">Impressão da Ficha</h3>
        <p className="text-sm text-zinc-400 mb-4">Módulo de impressão em desenvolvimento.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
