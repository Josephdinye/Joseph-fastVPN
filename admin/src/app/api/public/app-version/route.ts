// admin/src/api/public/app-version/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const DEFAULT = {
  latestVersion: '1.0.0',
  minVersion: '1.0.0',
  title: 'Update available',
  message: 'A new version of Joseph FastVPN is ready. Please update for the latest fixes and features.',
  downloadUrl: 'https://github.com/Josephdinye/Joseph-fastVPN/releases/latest',
  force: false,
};

export async function GET() {
  try {
    const snap = await adminDb.collection('settings').doc('app').get();
    const d = snap.exists ? snap.data() || {} : {};
    return NextResponse.json({
      success: true,
      latestVersion: String(d.latestVersion || DEFAULT.latestVersion),
      minVersion: String(d.minVersion || DEFAULT.minVersion),
      title: String(d.title || DEFAULT.title),
      message: String(d.message || DEFAULT.message),
      downloadUrl: String(d.downloadUrl || DEFAULT.downloadUrl),
      force: d.force === true,
    });
  } catch {
    return NextResponse.json({ success: true, ...DEFAULT });
  }
}