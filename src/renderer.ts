import appBridgeHook from './bridge';

const { appBridge, emit: localEmit, invoke: localInvoke } = appBridgeHook();
const { emit: bridgeEmit, invoke: bridgeInvoke } = window.initializeRendererAppBridge(localEmit, localInvoke);
appBridge.hook(bridgeEmit, bridgeInvoke);
Object.defineProperty(window, 'appBridge', {
    writable: false,
    enumerable: false,
    configurable: false,
    value: appBridge
});