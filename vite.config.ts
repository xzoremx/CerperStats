import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: 'dist-react',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                evaluation_select: path.resolve(__dirname, 'src-react/evaluation_select.html')
            }
        }
    },
    server: {
        port: 5173
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src-react')
        }
    }
})
