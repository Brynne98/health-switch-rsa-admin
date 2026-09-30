import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from GitHub Pages at /health-switch-rsa-admin/.
export default defineConfig({
  base: '/health-switch-rsa-admin/',
  plugins: [react()],
});
