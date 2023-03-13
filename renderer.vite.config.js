/** @type {import('vite').UserConfig} */
export default {
    build: {
        emptyOutDir: false,
        outDir: './dist/',
        lib: {
            entry: {
                renderer: './src/renderer.ts'
            },
            formats: ['es', 'umd'],
            name: 'appBridge'
        },
        minify: false
    }
};