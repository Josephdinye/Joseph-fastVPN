// admin/src/lib/security-log.ts
import { adminDb } from '@/lib/firebase-admin';

export type SecurityLogLevel = 'info' | 'warn' | 'error';

export async function writeSecurityLog(input: {
  type: string;
  level?: SecurityLogLevel;
  message: string;
  actorUid?: string | null;
  actorEmail?: string | null;
  targetUid?: string | null;
  targetEmail?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    await adminDb.collection('security_logs').add({
      type: input.type,
      level: input.level || 'info',
      message: input.message,
      actorUid: input.actorUid ?? null,
      actorEmail: input.actorEmail ?? null,
      targetUid: input.targetUid ?? null,
      targetEmail: input.targetEmail ?? null,
      meta: input.meta ?? null,
      createdAt: Date.now(),
    });
  } catch (e) {
    console.warn('writeSecurityLog failed:', e);
  }
}