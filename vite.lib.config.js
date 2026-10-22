import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  build:{
    lib:{ entry:'src/index.js', formats:['es'], fileName:()=>'noir-ui.js', cssFileName:'noir-ui' },
    rollupOptions:{ external:['react','react-dom','react/jsx-runtime','react-dom/client'] },
  },
});
