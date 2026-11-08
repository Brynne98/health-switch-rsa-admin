import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from Cloudflare Pages at https://admin.healthswitch.co.za/ (HSR-161).
export default defineConfig({
  plugins: [react()],
});
