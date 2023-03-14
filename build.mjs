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

// Build
const builds = ((...buildOptions) => {
    const res = [];

    // Creates an esbuild.build options entry for each build type in res
    buildOptions.forEach(options => {
        const base = { outdir: './dist', bundle: false, sourcemap: 'linked', platform: 'node', ...options};
        if (!Array.isArray(options.format)) {
            options.format = [ options.format ];
        }
        options.format.forEach(format => {
            const entry = { ...base, format };
            if (format === 'iife') {
                entry.platform = 'browser';
                entry.bundle = true;
            } else if (format === 'esm') {
                entry.outExtension = { '.js': '.mjs' };
            } else {
                entry.outExtension = { '.js': '.cjs' };
            }
            res.push(entry);
        });
    });

    // starts building of each entry
    return res.map(build);
})(
    {
        entryPoints: [ './src/index.ts', './src/bridge.ts', './src/preload.ts' ],
        format: ['cjs', 'esm']
    }, {
        entryPoints: [ './src/renderer.ts' ],
        format: 'iife'
    }
);


builds.push(

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
);

await Promise.all(builds);



console.log('done');