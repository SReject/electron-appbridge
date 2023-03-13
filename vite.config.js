/** @type {import('vite').UserConfig} */
export default {
    build: {
        emptyOutDir: false,
        outDir: './dist/',
        lib: {
            entry: {
                index: './out/index.js',
                main: './out/main.js',
                preload: './out/preload.js',
            },
            formats: ['es', 'cjs'],
            fileName: (format, name) => `${name}.${format === 'es' ? 'mjs' : 'cjs'}`
        },
        minify: false,
        rollupOptions: {
            external: [
                'node:path',
                'electron'
            ]
        }
    }
};