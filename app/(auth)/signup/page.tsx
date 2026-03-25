'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('ZA');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        role: 'both',  // All users are traders — role is per-deal, not per-user
        company_name: companyName,
        country,
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/map');
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mx-auto mb-4">
          <span className="text-black text-lg font-bold">M</span>
        </div>
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="text-gray-400 text-sm mt-1">Buy and sell bulk minerals directly</p>
        <p className="text-gray-500 text-xs mt-1">Chrome, iron ore, manganese, coal, platinum and more. No middlemen.</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="company" className="block text-sm text-gray-400 mb-1">Company name</label>
          <input
            id="company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="Your company"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="block text-sm text-gray-400 mb-1">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-sm text-gray-400 mb-1">Country</label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
          >
            <option value="ZA">South Africa</option>
            <option value="CN">China</option>
            <option value="IN">India</option>
            <option value="JP">Japan</option>
            <option value="KR">South Korea</option>
            <option value="AU">Australia</option>
            <option value="BR">Brazil</option>
            <option value="DE">Germany</option>
            <option value="NL">Netherlands</option>
            <option value="GB">United Kingdom</option>
            <option value="US">United States</option>
            <option value="TR">Turkey</option>
            <option value="MZ">Mozambique</option>
            <option value="ZW">Zimbabwe</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-white hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
