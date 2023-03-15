import { type AppBridge, createAppBridge } from "./bridge";

const { appBridge, emit: localEmit, invoke: localInvoke } = createAppBridge();
const { emit: bridgeEmit, invoke: bridgeInvoke } =
    window.initializeRendererAppBridge(localEmit, localInvoke);
appBridge.hook(bridgeEmit, bridgeInvoke);

const localAppBridge = {};
Object.entries(appBridge).forEach(([key, value]) => {
    if (key === "hook" || key === "unhook") {
        return;
    }
    Object.defineProperty(localAppBridge, key, {
        writable: false,
        configurable: false,
        enumerable: true,
        value
    });
});

export default <Omit<AppBridge, "hook" | "unhook">>localAppBridge;
