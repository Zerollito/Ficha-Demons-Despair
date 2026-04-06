import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface NumericInputProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function NumericInput({ label, value, onChange, className, min, max, size = "md" }: NumericInputProps) {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (value !== undefined && value !== null && value.toString() !== innerValue) {
      if (value === 0 && innerValue === '') return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className={cn("flex flex-col min-w-0", className)}>
      {label && <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 truncate">{label}</label>}
      <input 
        type="number" 
        value={innerValue} 
        min={min}
        max={max}
        onChange={e => {
          setInnerValue(e.target.value);
          onChange(parseInt(e.target.value) || 0);
        }}
        className={cn(
          "bg-black/20 border border-zinc-800/50 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-500 font-bold text-center w-full min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          size === "sm" && "py-1 px-1 text-xs",
          size === "md" && "py-2 px-2 text-sm",
          size === "lg" && "py-3 px-3 text-lg"
        )}
      />
    </div>
  );
}
