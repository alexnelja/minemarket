'use client';

import { useState } from 'react';

interface DealTabsProps {
  overviewContent: React.ReactNode;
  documentsContent: React.ReactNode;
  shippingContent: React.ReactNode;
  messagesContent: React.ReactNode;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'messages', label: 'Messages' },
];

export function DealTabs({ overviewContent, documentsContent, shippingContent, messagesContent }: DealTabsProps) {
  const [tab, setTab] = useState('overview');

  const content = {
    overview: overviewContent,
    documents: documentsContent,
    shipping: shippingContent,
    messages: messagesContent,
  };

  return (
    <>
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{content[tab as keyof typeof content]}</div>
    </>
  );
}
