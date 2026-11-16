import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base './' keeps picture and script paths relative, so the built site works in a sub-folder.
export default defineConfig({ base: './', plugins: [vue()] });
