import appBridgeHook from './bridge';

const { appBridge, emit: localEmit, invoke: localInvoke } = appBridgeHook();
const { emit: bridgeEmit, invoke: bridgeInvoke } = window.initializeRendererAppBridge(localEmit, localInvoke);
appBridge.hook(bridgeEmit, bridgeInvoke);

/** Reference to the renderer's app bridge instance
  * @typedef {import('./bridge').AppBridge} appBridge
  * @global
*/
Object.defineProperty(window, 'appBridge', {
    writable: false,
    enumerable: false,
    configurable: false,
    value: appBridge
});