'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const navItems = [
  { label: 'Map', href: '/map', icon: MapIcon },
  { label: 'Trading', href: '/trading', icon: TradingIcon },
  { label: 'Marketplace', href: '/marketplace', icon: MarketplaceIcon },
  { label: 'Deals', href: '/deals', icon: DealsIcon },
  { label: 'Vessels', href: '/vessels', icon: VesselsIcon },
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { label: 'Intelligence', href: '/intelligence', icon: IntelligenceIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
          <Link href="/map" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-black text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">MineMarket</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
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
        <Link href="/map" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
            <span className="text-black text-xs font-bold">M</span>
          </div>
          <span className="font-semibold text-sm">MineMarket</span>
        </Link>
        <nav className="flex gap-1 ml-4 flex-1 min-w-0 overflow-x-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
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

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500">
      <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11L13 8L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
