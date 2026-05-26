import React, { useState } from 'react';
import { EnemyGeneratorService, EnemyDifficulty, EnemyType } from '../services/enemyGeneratorService';
import { Character } from '../types';
import { Swords, User, Zap, Target, Skull, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

import { MaterialData } from '../data/materials';

interface EnemyGeneratorProps {
  onEnemyGenerated: (enemy: Character) => void;
  customMaterials?: MaterialData[];
}

export const EnemyGenerator: React.FC<EnemyGeneratorProps> = ({ onEnemyGenerated, customMaterials }) => {
  const [difficulty, setDifficulty] = useState<EnemyDifficulty>('base');
  const [type, setType] = useState<EnemyType>('corpo_a_corpo');
  const [customName, setCustomName] = useState('');

  const handleGenerate = () => {
    const enemy = EnemyGeneratorService.generateEnemy(difficulty, type, customName, customMaterials);
    onEnemyGenerated(enemy);
    setCustomName('');
  };

  return (
    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-4 shadow-2xl">
      <div className="flex items-center gap-2 text-red-500 font-bold text-sm uppercase tracking-wider">
        <Skull size={18} />
        Gerador de Inimigos Humanos
      </div>

      <div className="space-y-3">
        {/* Difficulty Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase font-bold px-1">Dificuldade</label>
          <div className="grid grid-cols-3 gap-1">
            {(['fraco', 'base', 'forte'] as EnemyDifficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "py-1.5 px-2 rounded border text-xs font-medium transition-all",
                  difficulty === d 
                    ? "bg-red-900/30 border-red-500 text-red-400" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800"
                )}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Type Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase font-bold px-1">Tipo de Inimigo</label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'corpo_a_corpo', label: 'C.C.', icon: Swords },
              { id: 'atirador', label: 'Atirador', icon: Target },
              { id: 'mago', label: 'Mago', icon: Zap },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id as EnemyType)}
                className={cn(
                  "py-2 px-2 rounded border text-[10px] flex flex-col items-center gap-1 transition-all",
                  type === t.id 
                    ? "bg-blue-900/30 border-blue-500 text-blue-400" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 uppercase font-bold px-1">Nome Customizado (Opcional)</label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Deixe vazio para automático"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-red-500/50"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-red-900/20"
        >
          <Plus size={16} />
          GERAR E ADICIONAR
        </button>
      </div>
    </div>
  );
};
