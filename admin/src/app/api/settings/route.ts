// admin/src/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { writeSecurityLog } from '@/lib/security-log';

const SETTINGS_REF = adminDb.collection('settings').doc('global');

export type AppSettings = {
  vpnServiceName: string;
  maxDevicesPerUser: number;
  maintenanceMode: boolean;
  allowUserRegistration: boolean;
  excludeRussiaByDefault: boolean;
  supportEmail: string;
  supportUrl: string;
  sessionNote: string;
  updatedAt: number | null;
  updatedBy: string | null;
};

const DEFAULTS: AppSettings = {
  vpnServiceName: 'Joseph FastVPN',
  maxDevicesPerUser: 3,
  maintenanceMode: false,
  allowUserRegistration: true,
  excludeRussiaByDefault: true,
  supportEmail: '',
  supportUrl: '',
  sessionNote: '',
  updatedAt: null,
  updatedBy: null,
};

function normalize(raw: Record<string, any> | undefined): AppSettings {
  const d = raw || {};
  return {
    vpnServiceName:
      typeof d.vpnServiceName === 'string' && d.vpnServiceName.trim()
        ? d.vpnServiceName.trim()
        : DEFAULTS.vpnServiceName,
    maxDevicesPerUser: Math.min(
      20,
      Math.max(1, Number(d.maxDevicesPerUser ?? DEFAULTS.maxDevicesPerUser) || 3)
    ),
    maintenanceMode: d.maintenanceMode === true,
    allowUserRegistration: d.allowUserRegistration !== false,
    excludeRussiaByDefault: d.excludeRussiaByDefault !== false,
    supportEmail: typeof d.supportEmail === 'string' ? d.supportEmail.trim() : '',
    supportUrl: typeof d.supportUrl === 'string' ? d.supportUrl.trim() : '',
    sessionNote: typeof d.sessionNote === 'string' ? d.sessionNote.trim() : '',
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : null,
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : null,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const snap = await SETTINGS_REF.get();
    const settings = normalize(snap.exists ? snap.data() : undefined);
    return NextResponse.json({ success: true, settings });
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

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const update: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: caller.email || caller.uid,
    };

    if (typeof body.vpnServiceName === 'string') {
      const name = body.vpnServiceName.trim().slice(0, 80);
      if (!name) {
        return NextResponse.json(
          { success: false, error: 'VPN service name cannot be empty' },
          { status: 400 }
        );
      }
      update.vpnServiceName = name;
    }

    if (body.maxDevicesPerUser !== undefined) {
      const n = Number(body.maxDevicesPerUser);
      if (!Number.isFinite(n) || n < 1 || n > 20) {
        return NextResponse.json(
          { success: false, error: 'Max devices must be between 1 and 20' },
          { status: 400 }
        );
      }
      update.maxDevicesPerUser = Math.floor(n);
    }

    if (typeof body.maintenanceMode === 'boolean') {
      update.maintenanceMode = body.maintenanceMode;
    }
    if (typeof body.allowUserRegistration === 'boolean') {
      update.allowUserRegistration = body.allowUserRegistration;
    }
    if (typeof body.excludeRussiaByDefault === 'boolean') {
      update.excludeRussiaByDefault = body.excludeRussiaByDefault;
    }
    if (typeof body.supportEmail === 'string') {
      update.supportEmail = body.supportEmail.trim().slice(0, 120);
    }
    if (typeof body.supportUrl === 'string') {
      update.supportUrl = body.supportUrl.trim().slice(0, 200);
    }
    if (typeof body.sessionNote === 'string') {
      update.sessionNote = body.sessionNote.trim().slice(0, 500);
    }

    await SETTINGS_REF.set(update, { merge: true });

    // serverTimestamp optional extra field for console readability
    try {
      await SETTINGS_REF.set({ updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
    } catch {
      // ignore
    }

    const snap = await SETTINGS_REF.get();
    const settings = normalize(snap.data());

    await writeSecurityLog({
      type: 'settings_updated',
      level: 'info',
      message: 'Admin updated global settings',
      actorUid: caller.uid,
      actorEmail: caller.email ?? null,
      meta: { keys: Object.keys(update) },
    });

    return NextResponse.json({ success: true, settings });
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