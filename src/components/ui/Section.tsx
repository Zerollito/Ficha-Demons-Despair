import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function Section({ title, icon, children, collapsible = false, defaultCollapsed = false }: SectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  return (
    <div className="bg-zinc-900/30 border-y sm:border border-zinc-800 sm:rounded-xl overflow-hidden -mx-4 sm:mx-0">
      <div 
        className={cn("px-4 py-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50", collapsible && "cursor-pointer hover:bg-zinc-800/50")}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500">{icon}</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300">{title}</h3>
        </div>
        {collapsible && (isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />)}
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
