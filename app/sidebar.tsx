'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const primaryItems = [
  { label: 'Deals', href: '/deals', icon: DealsIcon },
  { label: 'Positions', href: '/positions', icon: PositionsIcon },
  { label: 'Contracts', href: '/contracts', icon: ContractsIcon },
];

const marketItems = [
  { label: 'Map', href: '/map', icon: MapIcon },
  { label: 'Listings', href: '/marketplace', icon: MarketplaceIcon },
  { label: 'Prices', href: '/trading', icon: TradingIcon },
  { label: 'Simulator', href: '/simulator', icon: SimulatorIcon },
  { label: 'Scenarios', href: '/scenarios', icon: ScenariosIcon },
];

const secondaryItems = [
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { label: 'Vessels', href: '/vessels', icon: VesselsIcon },
  { label: 'Intelligence', href: '/intelligence', icon: IntelligenceIcon },
];

const mobileItems = [
  { label: 'Deals', href: '/deals', icon: DealsIcon },
  { label: 'Positions', href: '/positions', icon: PositionsIcon },
  { label: 'Contracts', href: '/contracts', icon: ContractsIcon },
  { label: 'Map', href: '/map', icon: MapIcon },
  { label: 'Listings', href: '/marketplace', icon: MarketplaceIcon },
  { label: 'Prices', href: '/trading', icon: TradingIcon },
  { label: 'Simulator', href: '/simulator', icon: SimulatorIcon },
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { label: 'Vessels', href: '/vessels', icon: VesselsIcon },
  { label: 'Intelligence', href: '/intelligence', icon: IntelligenceIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isMarketActive = pathname.startsWith('/map') || pathname.startsWith('/marketplace') || pathname.startsWith('/trading') || pathname.startsWith('/simulator') || pathname.startsWith('/scenarios');
  const [marketOpen, setMarketOpen] = useState(true);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col border-r border-gray-800 bg-gray-950 z-30">
        <div className="px-5 py-6">
          <Link href="/deals" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-black text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">MineMarket</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {/* Search trigger */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 w-full px-3 py-2 mb-2 text-xs text-gray-500 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Search...
            <kbd className="ml-auto text-[10px] text-gray-600 bg-gray-800 px-1 py-0.5 rounded">{'\u2318'}K</kbd>
          </button>
          {/* Primary: Deals */}
          {primaryItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                <item.icon active={active} />
                {item.label}
              </Link>
            );
          })}

          {/* Market section */}
          <div className="pt-3">
            <button
              onClick={() => setMarketOpen(!marketOpen)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
            >
              Market
              <span className="text-gray-600">{marketOpen ? '\u25BE' : '\u25B8'}</span>
            </button>
            {marketOpen && (
              <div className="ml-2 space-y-0.5">
                {marketItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-900'
                      }`}
                    >
                      <item.icon active={active} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider + Secondary */}
          <div className="pt-3 mt-3 border-t border-gray-800">
            {secondaryItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  <item.icon active={active} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition-colors w-full"
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md z-30 flex items-center px-4 gap-4">
        <Link href="/deals" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
            <span className="text-black text-xs font-bold">M</span>
          </div>
          <span className="font-semibold text-sm">MineMarket</span>
        </Link>
        <nav className="flex gap-1 ml-4 flex-1 min-w-0 overflow-x-auto">
          {mobileItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  );
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M1 3.5L5.5 1.5L10.5 3.5L15 1.5V12.5L10.5 14.5L5.5 12.5L1 14.5V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.5 1.5V12.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 3.5V14.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TradingIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M1 12L5 6L9 9L15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3H15V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarketplaceIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 6.5H15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 1.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 1.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DealsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IntelligenceIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 13V7H5V13H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 13V4H9.5V13H6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 13V1H14V13H11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function VesselsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 11L8 4L14 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 13H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 13V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 13V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SimulatorIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 10V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 10V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ScenariosIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 3H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 7H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 11H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PositionsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 14V6H5V14H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 14V2H9.5V14H6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 14V8H14V14H11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ContractsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 8H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 11H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500">
      <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11L13 8L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
