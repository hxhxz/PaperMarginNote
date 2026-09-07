import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        sidepanel: new URL('sidepanel.html', import.meta.url).pathname,
        knowledge: new URL('knowledge.html', import.meta.url).pathname,
      },
    },
  },
});
