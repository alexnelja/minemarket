'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/deals');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left: Value prop (desktop only) */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-900/50 border-r border-gray-800 px-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-white mb-4">The deal workspace for commodity traders</h2>
          <p className="text-gray-400 mb-6">Manage your deals, track documents, calculate margins — all in one place.</p>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">&#10003;</span>
              Deal simulator with live cost breakdown
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">&#10003;</span>
              Position book and contract tracking
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">&#10003;</span>
              Real-time vessel tracking and port data
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">&#10003;</span>
              Chrome &amp; manganese focused for SA traders
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-800">
            <Link href="/simulator" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
              Try the Deal Simulator — no account needed →
            </Link>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mx-auto mb-4">
              <span className="text-black text-lg font-bold">M</span>
            </div>
            <h1 className="text-xl font-bold">Sign in to MineMarket</h1>
            <p className="text-gray-400 text-sm mt-1">Bulk minerals marketplace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-white hover:underline">Sign up</Link>
          </p>

          <p className="text-center text-sm text-gray-600 mt-4 lg:hidden">
            <Link href="/simulator" className="text-amber-400 hover:text-amber-300">Try the simulator first →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
