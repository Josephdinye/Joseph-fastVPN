import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';

/** Placeholder until the VPN relay gateway is deployed */
export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(
      {
        success: false,
        error: 'Relay gateway is not configured yet',
      },
      { status: 501 }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}