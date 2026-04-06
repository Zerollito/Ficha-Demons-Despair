import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  label: string;
  current: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
}

export function ProgressBar({ label, current, max, color, onChange }: ProgressBarProps) {
  const percent = Math.min(100, (current / max) * 100);
  const [innerValue, setInnerValue] = useState(current?.toString() ?? '');

  useEffect(() => {
    if (current !== undefined && current !== null && current.toString() !== innerValue) {
      if (current === 0 && innerValue === '') return;
      setInnerValue(current.toString());
    }
  }, [current]);

  return (
    <div>
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-1">
          <input 
            type="number" 
            value={innerValue} 
            onChange={e => {
              setInnerValue(e.target.value);
              onChange(parseInt(e.target.value) || 0);
            }}
            className="min-w-[3rem] w-auto bg-transparent text-right font-bold text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-zinc-600">/ {max}</span>
        </div>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full p-0.5 border border-zinc-700/50">
        <motion.div 
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
