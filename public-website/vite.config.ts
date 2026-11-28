import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const proxy = {
  "/api": {
    target: process.env.VITE_API_TARGET || "http://127.0.0.1:8080",
    changeOrigin: true,
  },
};
export default defineConfig({
  plugins: [react()],
  server: { port: 3200, proxy },
  preview: { proxy },
});
