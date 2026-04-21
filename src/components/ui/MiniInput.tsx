import React, { useState, useEffect } from 'react';

interface MiniInputProps {
  label: string;
  value: any;
  type?: string;
  onChange: (v: string) => void;
}

export function MiniInput({ label, value, type = "text", onChange }: MiniInputProps) {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (value !== undefined && value !== null && value.toString() !== innerValue) {
      if (value === 0 && innerValue === '') return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">{label}</span>
      {type === "text" ? (
        <textarea 
          value={innerValue} 
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(e.target.value);
          }}
          rows={1}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 break-words whitespace-normal resize-none overflow-hidden min-h-[20px] w-full"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
      ) : (
        <input 
          type="text" 
          inputMode={type === 'number' ? 'numeric' : 'text'}
          value={innerValue} 
          onChange={e => {
            const val = type === 'number' ? e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.') : e.target.value;
            setInnerValue(val);
            onChange(val);
          }}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 w-full min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </div>
  );
}
