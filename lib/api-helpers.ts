import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from './supabase-server';

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export function unauthorized(message = 'Unauthorized'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = 'Not found'): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(err: unknown): NextResponse<ApiError> {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function conflict(message: string, details?: Record<string, unknown>): NextResponse<ApiError> {
  return NextResponse.json({ error: message, ...details }, { status: 409 });
}

// Auth helper — returns user or error response
export async function getAuthUser(): Promise<{ user: { id: string }; error?: never } | { user?: never; error: NextResponse<ApiError> }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: unauthorized() };
  return { user };
}
