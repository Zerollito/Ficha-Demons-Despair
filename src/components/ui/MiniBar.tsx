import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface MiniBarProps {
  label: string;
  value: number;
  max?: number;
  color: string;
  onChange: (v: number) => void;
}

export function MiniBar({ label, value, max = 100, color, onChange }: MiniBarProps) {
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
      <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={innerValue} 
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(parseInt(e.target.value) || 0);
          }}
          className="w-full bg-transparent text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
