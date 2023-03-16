## Install

### npm
```
npm install electron-appbridge@latest
```

### yarn
```
npm add electron-appbridge@latest
```


## Basic Usage

```js
// main-process.mjs

import { app } from 'electron'

// Import into the main process
import { createAppBridge } from 'electron-appbridge/main';

// Create an appbridge context
const appBridge = createAppBridge();

// Register accessibles
appBridge.register({
    path: 'foo',
    type: 'property',
    value: 'bar'
});

// Wait for the electron app to be ready
await app.whenReady();

// Create a new AppBridge'd window
let mainWindow = appBridge.createBrowserWindow(

    { /* Electron Browser Window Options */ },

    // When true, electron-appbridge will auto-load the preload-context
    // script if the browser window options does not have a preload script
    // specified
    true
);
```
```js
// renderer-process
import appBridge from 'electron-appbridge/renderer';

const result = await appBridge.get('foo');
```




