import type { NextConfig } from 'next';
const config: NextConfig = { serverExternalPackages: ['better-sqlite3'], poweredByHeader: false, webpack: config => { config.resolve.extensionAlias = { ...config.resolve.extensionAlias, '.js': ['.ts', '.tsx', '.js'] }; return config; } };
export default config;
