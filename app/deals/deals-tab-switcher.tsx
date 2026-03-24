'use client';

import { useState } from 'react';

interface DealsTabSwitcherProps {
  pipelineContent: React.ReactNode;
  shipmentContent: React.ReactNode;
}

export function DealsTabSwitcher({ pipelineContent, shipmentContent }: DealsTabSwitcherProps) {
  const [tab, setTab] = useState<'shipments' | 'pipeline'>('shipments');

  return (
    <>
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('shipments')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'shipments' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Shipments
        </button>
        <button
          onClick={() => setTab('pipeline')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'pipeline' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Pipeline
        </button>
      </div>

      {tab === 'shipments' ? shipmentContent : pipelineContent}
    </>
  );
}
