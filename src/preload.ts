import { contextBridge, ipcRenderer } from "electron";

import type {
    AppBridgeEmit,
    AppBridgeInvokeContext,
    AppBridgeReply,
    AppBridgeInvoke,
    AppBridgeReplyStatus
} from "./bridge";

type AppBridgeInvokeResponse = {
    id: number | string;
    status: AppBridgeReplyStatus;
    result: unknown;
};

let initialized = false;
const initAppBridge = (
    renderEmit: AppBridgeEmit,
    renderInvoke: AppBridgeInvoke
): { emit: AppBridgeEmit; invoke: AppBridgeInvoke } => {
    if (initialized) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return;
    }

    initialized = true;

    ipcRenderer.on(
        "AppBridge:Emit",
        (ignore: Electron.IpcRendererEvent, { name, data }) => {
            renderEmit(name, data);
        }
    );

    ipcRenderer.on(
        "AppBridge:Invoke",
        (ignore: Electron.IpcRendererEvent, { id, path, context, args }) => {
            const reply: AppBridgeReply = (
                status: "error" | "ok",
                result: unknown
            ) => {
                ipcRenderer.send("AppBridge:Invoke:Reply", {
                    id,
                    status,
                    result
                });
            };
            renderInvoke(reply, path, context, args);
        }
    );

    return {
        emit: (name: string, data?: unknown) => {
            ipcRenderer.send(name, data);
        },
        invoke: <AppBridgeInvoke>((
            reply: AppBridgeReply,
            path: string,
            context: AppBridgeInvokeContext,
            args: unknown[]
        ) => {
            let id = "";
            for (let idx = 0; idx < 64; idx += 1) {
                const charCode = Math.floor(Math.random() * (126 - 32)) + 33;
                id += String.fromCharCode(charCode);
            }

            const handler = (
                event: Electron.IpcRendererEvent,
                data: AppBridgeInvokeResponse
            ) => {
                if (data.id !== id) {
                    return;
                }
                ipcRenderer.removeListener("AppBridge:Invoke:Reply", handler);
                if (data.status === "ok") {
                    reply("ok", data.result);
                } else {
                    reply("error", data.result);
                }
            };
            ipcRenderer.on("AppBridge:Invoke:Reply", handler);
            ipcRenderer.send("AppBridge:Invoke", {
                id,
                path,
                context,
                args
            });
        })
    };
};

export type initializeAppBridge = typeof initAppBridge;

contextBridge.exposeInMainWorld("initializeRendererAppBridge", initAppBridge);
