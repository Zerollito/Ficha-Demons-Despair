import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface MiniBarProps {
  label: string;
  value: number;
  max?: number;
  color: string;
  onChange: (v: number) => void;
  extra?: React.ReactNode;
}

export function MiniBar({ label, value, max = 100, color, onChange, extra }: MiniBarProps) {
  const percent = Math.min(100, (value / max) * 100);
  const [innerValue, setInnerValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (value !== undefined && value !== null && value.toString() !== innerValue) {
      if (value === 0 && innerValue === '') return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-lg">
      <div className="flex justify-between items-center mb-1">
        <div 
          className="text-[9px] text-zinc-500 hover:text-zinc-300 font-bold uppercase cursor-pointer select-none transition-colors"
          onDoubleClick={() => onChange(max)}
          title="Clique duplo para recuperar totalmente"
        >
          {label}
        </div>
        {extra}
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={innerValue} 
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(parseInt(e.target.value) || 0);
          }}
          className="w-full min-w-[3rem] bg-transparent text-base font-bold text-zinc-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div 
        className="h-2 bg-zinc-800 rounded-full mt-1 overflow-hidden cursor-pointer"
        onDoubleClick={() => onChange(max)}
        title="Clique duplo para recuperar totalmente"
      >
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
