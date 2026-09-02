import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget =
  process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000";

const frontendHost =
  process.env.VITE_FRONTEND_HOST || "localhost";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 5173,

    allowedHosts: [frontendHost],

    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
      "/media": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});