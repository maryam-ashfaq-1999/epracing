import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works when served from a GitHub Pages
  // project subpath (https://<user>.github.io/<repo>/) without needing to
  // hardcode the repo name here.
  base: './',
  assetsInclude: ['**/*.obj'],
  server: {
    port: 5173,
    host: true,
  },
});
