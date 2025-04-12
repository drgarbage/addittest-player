import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  publicDir: 'public',
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'cert/addittest.duckdns.org-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert/addittest.duckdns.org.pem')),
    },
    host: true,
    port: 3000,
  }
})
