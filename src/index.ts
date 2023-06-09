import electron from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createAppBridge as generateAppBridge,
    type AppBridge,
    type AppBridgeEmit,
    type AppBridgeInvoke,
    type AppBridgeReplyStatus,
    type AppBridgeInvokeContext
} from "./bridge";

const {
    BrowserWindow: ElectronBrowserWindow
} = electron;

/** Represents a response of an invoke request
 * @property {number | string} id - The id the response is associated with
 * @property {AppBridgeReplyStatus} status - The status of the invoke result's response
 * @property {*} result - The resulting value of the call or incases of an error, the error message
 */
type AppBridgeResponse = {
    id: number | string;
    status: AppBridgeReplyStatus;
    result: unknown;
};

/** AppBridge Hooked BrowserWindow */
declare class AppBridgeBrowserWindow extends Electron.BrowserWindow {
    public readonly appBridge: undefined | MainAppBridge;
}

/** Main Process AppBridge instance */
interface MainAppBridge extends Omit<AppBridge, "hook"> {

    /** Unhooks from any previously hooked window and applies hooks to the specified BrowserWindow.
     * @param browserWindow - The electron browser window to hook
     * @returns {AppBridgeBrowserWindow}
     */
    hook: (browserWindow: Electron.BrowserWindow) => AppBridgeBrowserWindow;

    /** Creates a new BrowserWindow and hooks it for communication
     * @param options - BrowserWindow options
     * @param preload - If true and a preload script has not been specified, the app bridge preload script will be applied
     * @returns {AppBridgeBrowserWindow}
     */
    createBrowserWindow: (
        options: Electron.BrowserWindowConstructorOptions,
        preload?: boolean
    ) => AppBridgeBrowserWindow;
}

let dir: string;
if (require && require.main) {
    dir = __dirname;

} else {
    dir = fileURLToPath(new URL( ".", import.meta.url ));
}

/** Path to the preload IIFE script file
 * @type {string}
 */
export const preloadPath = resolve(dir, "./preload.iife.js");

/** Path to the preload CJS script file
 * @type {string}
 */
export const preloadPathCJS = resolve(dir, "./preload.cjs");

/** Path to the preload ESM script file
 * @type {string}
 */
export const preloadPathESM = resolve(dir, "./preload.mjs");

/** Path to the renderer-process IIFE script file
 * @type {string}
 */
export const rendererPath = resolve(dir, "./renderer.iife.js");

/** Path to the renderer-process CJS script file
 * @type {string}
 */
export const rendererPathCJS = resolve(dir, "./renderer.cjs");

/** Path to the renderer-process ESM script file
 * @type {string}
 */
export const rendererPathESM = resolve(dir, "./renderer.mjs");

/** Returns a new AppBridge Instance
 * @returns {MainAppBridge}
 */
export const createAppBridge = (): MainAppBridge => {
    const {
        appBridge,
        emit: localEmit,
        invoke: localInvoke
    } = generateAppBridge();

    let hookedWindow: undefined | AppBridgeBrowserWindow;

    const closeHandler = () => {
        appBridge.unhook();
    };

    const bridge: MainAppBridge = Object.create(
        null,
        {
            createBrowserWindow: {
                configurable: false,
                writable: false,
                enumerable: true,
                value: (options: Electron.BrowserWindowConstructorOptions, preload = true): AppBridgeBrowserWindow => {
                    bridge.unhook();

                    if (preload === true) {
                        if (options == null) {
                            options = {webPreferences: {preload: preloadPath}};

                        } else if (options.webPreferences == null) {
                            options.webPreferences = {preload: preloadPath};

                        } else if (options.webPreferences.preload == null) {
                            options.webPreferences.preload = preloadPath;
                        }
                    }

                    const browserWindow = new ElectronBrowserWindow(options);

                    Object.defineProperty(
                        browserWindow,
                        "appBridge",
                        {
                            writable: true,
                            enumerable: true,
                            configurable: false,
                            value: bridge
                        }
                    );

                    bridge.hook(browserWindow);

                    return <AppBridgeBrowserWindow>browserWindow;
                }
            },
            hook: {
                configurable: false,
                writable: false,
                enumerable: true,
                value: (browserWindow: electron.BrowserWindow): AppBridgeBrowserWindow => {
                    bridge.unhook();

                    const hookedEmit: AppBridgeEmit = (name, data) => {
                        browserWindow.webContents.send(
                            "AppBridge:Emit",
                            {
                                name,
                                data
                            }
                        );
                    };

                    const hookedInvoke: AppBridgeInvoke = (reply, path, context, args): void => {

                        let id = "";
                        for (let idx = 0; idx < 64; idx += 1) {
                            const charCode = Math.floor(Math.random() * (126 - 32)) + 33;
                            id += String.fromCharCode(charCode);
                        }
                        const handler = (ignore: Electron.IpcMainEvent, data: AppBridgeResponse) => {
                            if (data == null || data.id !== id) {
                                return;
                            }

                            browserWindow.webContents.ipc.removeListener("AppBridge:Invoke:Reply", handler);
                            if (data.status === "ok") {
                                reply("ok", data.result);

                            } else if (data.status === "error") {
                                reply("error", data.result);

                            } else {
                                reply("error", "invalid response");
                            }
                        };

                        browserWindow.webContents.ipc.on("AppBridge:Invoke:Reply", handler);
                        browserWindow.webContents.send(
                            "AppBridge:Invoke",
                            {
                                id,
                                path,
                                context,
                                args
                            }
                        );
                    };

                    appBridge.hook(hookedEmit, hookedInvoke);

                    browserWindow.webContents.ipc.on(
                        "AppBridge:Emit",
                        (ignore: Electron.IpcMainEvent, data: { name: string; data: unknown }) => localEmit(data.name, data.data)
                    );

                    browserWindow.webContents.ipc.on(
                        "AppBridge:Invoke",
                        (
                            ignore: Electron.IpcMainEvent,
                            data: {
                                id: number | string;
                                path: string;
                                context: AppBridgeInvokeContext;
                                args: unknown[];
                            }
                        ) => {
                            const reply = (status: AppBridgeReplyStatus, result: unknown) => {

                                if (hookedWindow !== browserWindow) {
                                    return;
                                }

                                browserWindow.webContents.send(
                                    "AppBridge:Invoke:Reply",
                                    {
                                        id: data.id,
                                        status,
                                        result
                                    }
                                );
                            };
                            localInvoke(reply, data.path, data.context, data.args);
                        }
                    );

                    browserWindow.once("closed", closeHandler);

                    Object.defineProperty(
                        browserWindow,
                        "appBridge",
                        {
                            writable: true,
                            enumerable: true,
                            configurable: false,
                            value: bridge
                        }
                    );

                    return (hookedWindow = <AppBridgeBrowserWindow>browserWindow);
                }
            },
            unhook: {
                configurable: false,
                writable: false,
                enumerable: true,
                value: () => {
                    appBridge.unhook();
                    if (hookedWindow) {
                        //eslint-disable-next-line @typescript-eslint/no-explicit-any
                        delete (<any>hookedWindow).appBridge;
                        hookedWindow.off("closed", closeHandler);
                        hookedWindow.webContents.ipc.removeAllListeners("AppBridge:Emit");
                        hookedWindow.webContents.ipc.removeAllListeners("AppBridge:Invoke");
                        hookedWindow.webContents.ipc.removeAllListeners("AppBridge:Invoke:Reply");
                        hookedWindow = undefined;
                    }
                }
            }
        }
    );

    Object
        .entries(appBridge)
        .forEach(([
            key,
            value
        ]) => {
            if (key === "hook" || key === "unhook" || key === "createBrowserWindow") {
                return;
            }
            Object.defineProperty(
                bridge,
                key,
                {
                    writable: false,
                    configurable: false,
                    enumerable: true,
                    value
                }
            );
        });

    return bridge;
};
