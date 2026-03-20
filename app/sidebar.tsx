"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/", icon: OverviewIcon },
  { label: "Deployments", href: "/deployments", icon: DeploymentsIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col border-r border-gray-800 bg-gray-950 z-30">
        <div className="px-5 py-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-black text-xs font-bold">▲</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">Dashboard</span>
          </Link>
        </div>
        <nav className="flex-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-900"
                }`}
              >
                <item.icon active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md z-30 flex items-center px-4 gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
            <span className="text-black text-xs font-bold">▲</span>
          </div>
          <span className="font-semibold text-sm">Dashboard</span>
        </Link>
        <nav className="flex gap-1 ml-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Mobile spacer */}
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  );
}

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={active ? "text-white" : "text-gray-500"}
    >
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DeploymentsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={active ? "text-white" : "text-gray-500"}
    >
      <path
        d="M8 1L14 5V11L8 15L2 11V5L8 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 15V8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 5L8 8L2 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
