/** @type {import('vite').UserConfig} */
export default {
    build: {
        emptyOutDir: false,
        outDir: './dist/',
        lib: {
            entry: {
                renderer: './out/renderer.js'
            },
            formats: ['es', 'umd'],
            name: 'appBridge'
        },
        minify: false
    }
};