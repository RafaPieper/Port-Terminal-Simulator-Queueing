import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Port-Terminal-Simulator-Queueing/', // <-- Exact match of your repo name
})