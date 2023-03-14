import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { exec } from 'node:child_process';

// Remove ./dist dir
console.info('Preparing output directory');
try {
    rmSync('./dist/', { recursive: true, force: true });
    mkdirSync('./dist/');
    console.info('Output directory ready');
} catch (error) {
    console.error(error);
    process.exit(1);
}

const baseOptions = { outdir: './dist', bundle: false, sourcemap: 'linked', platform: 'node' }
await Promise.all([

    // build for environments
    build({
        ...baseOptions,
        entryPoints: [ './src/index.ts', './src/bridge.ts', './src/preload.ts' ],
        format: 'esm',
        outExtension: { '.js': '.mjs' },
    }),
    build({
        ...baseOptions,
        entryPoints: [ './src/index.ts', './src/bridge.ts', './src/preload.ts' ],
        format: 'cjs'
    }),
    build({
        ...baseOptions,
        entryPoints: [ './src/renderer.ts' ],
        format: 'esm',
        bundle: true,
        outExtension: { '.js': '.mjs' },
    }),
    build({
        ...baseOptions,
        entryPoints: [ './src/renderer.ts' ],
        format: 'cjs',
        bundle: true
    }),
    build({
        ...baseOptions,
        entryPoints: [ './src/renderer.ts' ],
        platform: 'browser',
        bundle: true,
        format: 'iife',
        globalName: 'window.appBridge',
        outExtension: { '.js': '.iife.js' }
    }),


    // Copy package.json, LICENSE, and README.md
    copyFile('./package.json', './dist/package.json'),
    copyFile('./README.md', './dist/README.md'),
    copyFile('./LICENSE', './dist/LICENSE'),

    // Generate .d.ts files
    new Promise((resolve, reject) => {
        exec('npm run declarations', (error, stdout, stderr) => {
            if (error) {
                console.error(error);
                reject(error);
            } else if (stderr) {
                console.error(stderr);
                reject(stderr);
            } else {
                console.log(stdout);
                resolve(stdout);
            }
        });
    })
]);

console.log('done');