import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/world-projection/' : '/',
  server: {
    host: true
  }
});
