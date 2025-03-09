import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  publicDir: 'public',
  server: {
    host: true, // Listen on all network interfaces
    port: 3000, // You can specify any port you prefer
  },
})
