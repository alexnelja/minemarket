'use client';
import { useState } from 'react';

export function CollapsibleSection({ title, subtitle, children, defaultOpen = false }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-gray-500 text-sm">{open ? '\u25be' : '\u25b8'}</span>
      </button>
      {open && <div className="px-6 pb-4">{children}</div>}
    </div>
  );
}
