import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    optimizeDeps: {
        exclude: ['@babylonjs/havok'],
    },
    server: {
        // HTTPS for local development only
        https: fs.existsSync(path.resolve(__dirname, 'localhost.key')) ? {
            key: fs.readFileSync(path.resolve(__dirname, 'localhost.key')),
            cert: fs.readFileSync(path.resolve(__dirname, 'localhost.crt')),
        } : undefined,
        host: true,
    },
});
