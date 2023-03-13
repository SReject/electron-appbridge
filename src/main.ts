import { BrowserWindow as ElectronBrowserWindow } from 'electron';
import { resolve } from 'node:path' ;
import { fileURLToPath } from 'node:url';

import {
    default as createAppBridge,
    type AppBridge,
    type AppBridgeEmit,
    type AppBridgeInvoke,
    type AppBridgeReplyStatus,
    type AppBridgeResponse,
    type AppBridgeInvokeContext
}from '.';

type MainAppBridgeDetails = { appBridge: MainAppBridge, emit: AppBridgeEmit, invoke: AppBridgeInvoke };

declare class AppBridgeBrowserWindow extends ElectronBrowserWindow {
    public readonly appBridge : undefined | MainAppBridge;
}

interface MainAppBridge extends Omit<AppBridge, 'hook'> {
    hook: (browserWindow: ElectronBrowserWindow) => MainAppBridgeDetails;
    createBrowserWindow: (options: Electron.BrowserWindowConstructorOptions) => AppBridgeBrowserWindow;
}

let dir : string;
if (module != null && module.exports) {
    dir = __dirname;
} else {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    dir = fileURLToPath(new URL('.', import.meta.url));
}

export const preloadPath = resolve(dir, './preload.js');
export const frontendPath = resolve(dir, './frontend.js');

export const appBridge = () : MainAppBridge => {
    const { appBridge, emit: localEmit, invoke: localInvoke } = createAppBridge();

    let hookedWindow: undefined | AppBridgeBrowserWindow;

    const closeHandler = () => {
        appBridge.unhook();
    };

    const bridge : MainAppBridge = Object.create(null, {
        createBrowserWindow: {
            configurable: false,
            writable: false,
            enumerable: true,
            value: (options: Electron.BrowserWindowConstructorOptions, preload = true) : AppBridgeBrowserWindow => {
                bridge.unhook();

                if (preload === true) {
                    if (options == null) {
                        options = { webPreferences: { preload: preloadPath }};
                    } else if (options.webPreferences == null) {
                        options.webPreferences = { preload: preloadPath };
                    } else if (options.webPreferences.preload == null) {
                        options.webPreferences.preload = preloadPath;
                    }
                }

                const browserWindow = new ElectronBrowserWindow(options);

                Object.defineProperty(browserWindow, 'appBridge', {
                    writable: true,
                    enumerable: true,
                    configurable: false,
                    value: bridge
                });

                bridge.hook(browserWindow);

                return <AppBridgeBrowserWindow>browserWindow;
            }
        },
        hook: {
            configurable: false,
            writable: false,
            enumerable: true,
            value: (browserWindow: ElectronBrowserWindow) : AppBridgeBrowserWindow => {
                bridge.unhook();

                const hookedEmit : AppBridgeEmit = (name, data) => {
                    browserWindow.webContents.send('AppBridge:Emit', { name, data });
                };

                const hookedInvoke : AppBridgeInvoke = (reply, path, context, args) : void => {
                    let id = '';
                    for (let idx = 0; idx < 64; idx += 1) {
                        const charCode = Math.floor(Math.random() * (126 - 32)) + 33;
                        id += String.fromCharCode(charCode);
                    }
                    const handler = (ignore: Electron.IpcMainEvent, data: AppBridgeResponse) => {
                        if (data == null || data.id !== id) {
                            return;
                        }
                        browserWindow.webContents.ipc.removeListener('AppBridge:Invoke:Reply', handler);
                        if (data.status === 'ok') {
                            reply('ok', data.result);
                        } else if (data.status === 'error') {
                            reply('error', data.result);
                        } else {
                            reply('error', 'invalid response');
                        }
                    };
                    browserWindow.webContents.ipc.on('AppBridge:Invoke:Reply', handler);
                    browserWindow.webContents.send('AppBridge:Invoke', { id, path, context, args});
                };

                appBridge.hook(hookedEmit, hookedInvoke);

                browserWindow.webContents.ipc.on('AppBridge:Emit', (ignore: Electron.IpcMainEvent, data: {name: string, data: unknown}) => {
                    localEmit(data.name, data.data);
                });

                browserWindow.webContents.ipc.on('AppBridge:Invoke', (ignore: Electron.IpcMainEvent, data: {id: number | string, path: string, context: AppBridgeInvokeContext, args: unknown[]}) => {
                    const reply = (status: AppBridgeReplyStatus, result: unknown) => {
                        if (hookedWindow !== browserWindow) {
                            return;
                        }
                        browserWindow.webContents.send('AppBridge:Invoke:Reply', { id: data.id, status, result });
                    };
                    localInvoke(reply, data.path, data.context, data.args);
                });

                browserWindow.once('closed', closeHandler);

                Object.defineProperty(browserWindow, 'appBridge', {
                    writable: true,
                    enumerable: true,
                    configurable: false,
                    value: bridge
                });

                return <AppBridgeBrowserWindow>browserWindow;
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
                    hookedWindow.off('closed', closeHandler);
                    hookedWindow.webContents.ipc.removeAllListeners('AppBridge:Emit');
                    hookedWindow.webContents.ipc.removeAllListeners('AppBridge:Invoke');
                    hookedWindow.webContents.ipc.removeAllListeners('AppBridge:Invoke:Reply');
                    hookedWindow = undefined;
                }
            }
        }
    });

    Object
        .entries(appBridge)
        .forEach(([key, value]) => {
            if (key === 'hook') {
                return;
            }
            Object.defineProperty(bridge, key, {
                writable: false,
                configurable: false,
                enumerable: true,
                value
            });
        });


    return bridge;
};