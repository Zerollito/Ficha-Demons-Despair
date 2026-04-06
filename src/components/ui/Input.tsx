import React from 'react';

interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function Input({ label, value, onChange, className }: InputProps) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea 
        value={value ?? ''} 
        onChange={e => onChange(e.target.value)}
        rows={1}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none overflow-hidden min-h-[38px]"
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${target.scrollHeight}px`;
        }}
      />
    </div>
  );
}

export function TextArea({ label, value, onChange, className }: InputProps) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea 
        value={value ?? ''} 
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none"
      />
    </div>
  );
}
