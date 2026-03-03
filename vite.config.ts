import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const keyPath = path.resolve(__dirname, 'cert/addittest.duckdns.org-key.pem');
  const certPath = path.resolve(__dirname, 'cert/addittest.duckdns.org.pem');
  const httpsConfig =
    command === 'serve' && fs.existsSync(keyPath) && fs.existsSync(certPath)
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined;

  return {
    plugins: [react(), tsconfigPaths()],
    publicDir: 'public',
    server: {
      https: httpsConfig,
      host: true,
      port: 3000,
    },
  };
});
