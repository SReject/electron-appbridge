import { viteStaticCopy } from 'vite-plugin-static-copy';

/** @type {import('vite').UserConfig} */
export default {
    build: {
        emptyOutDir: false,
        outDir: './dist/',
        lib: {
            entry: {
                bridge: './src/bridge.ts',
                index: './src/index.ts',
                preload: './src/preload.ts',
            },
            formats: ['es', 'cjs'],
            fileName: (format, name) => `${name}.${format === 'es' ? 'mjs' : 'cjs'}`
        },
        minify: false,
        rollupOptions: {
            external: [
                'node:path',
                'node:url',
                'electron'
            ]
        }
    },
    plugins: [
        viteStaticCopy({
            targets: [
                { src: 'package.json', dest: '' },
                { src: 'LICENSE', dest: '' },
                { src: 'README.md', dest: '' }
            ]
        })
    ]
};