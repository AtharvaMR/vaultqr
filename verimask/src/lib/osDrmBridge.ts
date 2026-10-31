/**
 * OS-Level Screenshot & Screen Recording Hardware Blocker
 * Used when running the Vault inside Electron, Capacitor, or Native WebView.
 */

// A. ELECTRON MAIN PROCESS SETUP (main.ts)
export function applyElectronOsCaptureBlock(mainWindow: any) {
  if (!mainWindow) return;

  // Activates Windows WDA_EXCLUDEFROMCAPTURE & macOS NSWindowSharingNone
  mainWindow.setContentProtection(true);

  // Prevent window contents from being captured by OS thumbnail switchers (Alt+Tab / Mission Control)
  mainWindow.on('blur', () => {
    mainWindow.webContents.send('verimask:os-focus-lost');
  });
}

// B. ELECTRON PRELOAD BRIDGE (preload.ts)
export function exposeElectronDrmBridge(contextBridge: any, ipcRenderer: any) {
  contextBridge.exposeInMainWorld('veriMaskNative', {
    enableOsContentProtection: (enable: boolean) =>
      ipcRenderer.invoke('verimask:set-content-protection', enable),
  });
}

// C. CAPACITOR / ANDROID NATIVE WEBVIEW (MainActivity.java equivalent trigger)
/*
  In Android (Java/Kotlin), add this inside MainActivity.onCreate():
  getWindow().setFlags(
    WindowManager.LayoutParams.FLAG_SECURE,
    WindowManager.LayoutParams.FLAG_SECURE
  );

  In iOS (Swift), bind to UIScreen.capturedDidChangeNotification:
  NotificationCenter.default.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { _ in
    if UIScreen.main.isCaptured {
      // Immediately hide WebView or dispatch blackout event
    }
  }
*/
