// windows/api-config.js
module.exports = {
  API_BASE: process.env.JOSEPH_API_BASE || 'https://josephfastvpn.vercel.app',
  NODES_PATH: '/api/public/nodes',
  VERSION_PATH: '/api/public/app-version',
  // MUST match Vercel NODES_API_KEY exactly
  API_KEY: process.env.JOSEPH_API_KEY || 'a6b40fdae9fc0fdbe9fd9d49cd4007c63dba9690132c989a196de6d86e195da8',
  REFRESH_MS: 5 * 60 * 1000,
};