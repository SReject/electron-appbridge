import { build } from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { exec } from "node:child_process";

// Remove ./dist dir
console.info("Preparing output directory");
try {
    rmSync("./dist/", { recursive: true, force: true });
    mkdirSync("./dist/");
    console.info("Output directory ready");
} catch (error) {
    console.error(error);
    process.exit(1);
}

const baseOptions = {
    outdir: "./dist",
    bundle: false,
    sourcemap: "linked",
    platform: "node",
    external: ["electron"]
};

const fixImportPath = (suffix) => {
    return {
        name: "add-extension",
        setup(build) {
            build.onResolve({ filter: /[\\/].+$/ }, (args) => {
                if (
                    args.kind === "import-statement" ||
                    args.kind === "require-call"
                ) {
                    return {
                        path: `${args.path}.${suffix}`,
                        external: true
                    };
                }
            });
        }
    };
};
await Promise.all([
    // build for environments
    build({
        ...baseOptions,
        entryPoints: ["./src/index.ts", "./src/bridge.ts", "./src/preload.ts"],
        format: "esm",
        bundle: true,
        outExtension: { ".js": ".mjs" },
        plugins: [fixImportPath("mjs")],
        external: ["electron"]
    }),
    build({
        ...baseOptions,
        entryPoints: ["./src/index.ts", "./src/bridge.ts", "./src/preload.ts"],
        format: "cjs",
        bundle: true,
        outExtension: { ".js": ".cjs" },
        plugins: [fixImportPath("cjs")],
        external: ["electron"]
    }),
    build({
        ...baseOptions,
        entryPoints: ["./src/preload.ts"],
        format: "iife",
        bundle: true,
        outExtension: { ".js": ".iife.js" },
        external: ["electron"],
        globalName: "preload"
    }),
    build({
        ...baseOptions,
        entryPoints: ["./src/renderer.ts"],
        format: "esm",
        bundle: true,
        outExtension: { ".js": ".mjs" },
        plugins: [fixImportPath("mjs")],
        external: ["electron"]
    }),
    build({
        ...baseOptions,
        entryPoints: ["./src/renderer.ts"],
        format: "cjs",
        outExtension: { ".js": ".cjs" },
        plugins: [fixImportPath("cjs")],
        bundle: true,
        external: ["electron"]
    }),
    build({
        ...baseOptions,
        entryPoints: ["./src/renderer.ts"],
        platform: "browser",
        bundle: true,
        format: "iife",
        globalName: "window.appBridge",
        outExtension: { ".js": ".iife.js" },
        external: ["electron"],

        // this is here to unwrap the default export as esbuild doesn't provide such an option
        footer: { js: ";window.appBridge = window.appBridge.default;" }
    }),

    // Copy package.json, LICENSE, and README.md
    copyFile("./package.json", "./dist/package.json"),
    copyFile("./README.md", "./dist/README.md"),
    copyFile("./LICENSE", "./dist/LICENSE"),

    // Generate .d.ts files
    new Promise((resolve, reject) => {
        exec("npm run declarations", (error, stdout, stderr) => {
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

console.log("done");
