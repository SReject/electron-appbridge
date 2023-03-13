import { type initializeAppBridge } from './preload';

declare global {
    interface Window {
        initializeRendererAppBridge: initializeAppBridge;
    }
}