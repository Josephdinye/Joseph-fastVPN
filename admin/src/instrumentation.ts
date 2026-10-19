// admin/src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Nodes] Instrumentation starting...');
    try {
      const { refreshNodes } = await import('./lib/nodes/worker');
      
      // Fetch immediately on server start from .env URL
      void refreshNodes();

      // Then refresh every 5 min
      const interval = Number(process.env.NODE_TEST_INTERVAL || 300000);
      setInterval(() => {
        void refreshNodes();
      }, interval);

      console.log(`[Nodes] Worker scheduled every ${interval / 1000}s`);
    } catch (e) {
      console.error('[Nodes] Failed to start worker', e);
    }
  }
}