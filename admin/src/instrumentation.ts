// admin/src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNodeWorker } = await import('./lib/nodes/worker');
    startNodeWorker();
  }
}