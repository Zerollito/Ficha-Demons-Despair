import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SubSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function SubSection({ title, icon, children, defaultCollapsed = true }: SubSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const hasChildren = React.Children.toArray(children).some(child => child !== null);
  
  if (!hasChildren) return null;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/20">
      <div 
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors bg-zinc-800/20"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500/70">{icon}</span>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{title}</h4>
        </div>
        {isCollapsed ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronUp size={14} className="text-zinc-500" />}
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-2 space-y-2 border-t border-zinc-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
