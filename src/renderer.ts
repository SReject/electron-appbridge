import appBridgeHook from './bridge';

const { appBridge, emit: localEmit, invoke: localInvoke } = appBridgeHook();
const { emit: bridgeEmit, invoke: bridgeInvoke } = window.initializeRendererAppBridge(localEmit, localInvoke);
appBridge.hook(bridgeEmit, bridgeInvoke);

export default appBridge;