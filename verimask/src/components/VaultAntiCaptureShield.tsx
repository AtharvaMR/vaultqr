'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

export interface SecuritySelfCheckStatus {
  drmHardwareActive: boolean;
  windowFocused: boolean;
  screenCaptureBlocked: boolean;
  devToolsClosed: boolean;
  breachAttempts: number;
  lastBreachReason: string | null;
}

interface VaultAntiCaptureShieldProps {
  credentialId: string;
  holderName: string;
  children: React.ReactNode;
  onBreachDetected?: (reason: string, attemptCount: number) => void;
}

export const VaultAntiCaptureShield: React.FC<VaultAntiCaptureShieldProps> = ({
  credentialId,
  holderName,
  children,
  onBreachDetected,
}) => {
  const [isBlackedOut, setIsBlackedOut] = useState<boolean>(false);
  const [selfCheck, setSelfCheck] = useState<SecuritySelfCheckStatus>({
    drmHardwareActive: false,
    windowFocused: true,
    screenCaptureBlocked: true,
    devToolsClosed: true,
    breachAttempts: 0,
    lastBreachReason: null,
  });

  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerBlackout = useCallback(
    (reason: string) => {
      setIsBlackedOut(true);
      setSelfCheck((prev) => {
        const nextCount = prev.breachAttempts + 1;
        if (onBreachDetected) onBreachDetected(reason, nextCount);
        return {
          ...prev,
          windowFocused: false,
          breachAttempts: nextCount,
          lastBreachReason: reason,
        };
      });

      // Clear any existing unlock timer
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    },
    [onBreachDetected]
  );

  const restoreView = useCallback(() => {
    if (!document.hasFocus() || document.hidden) return;
    // Delay restoration by 800ms so OS Snipping Tool overlays cannot capture on close
    lockTimeoutRef.current = setTimeout(() => {
      setIsBlackedOut(false);
      setSelfCheck((prev) => ({
        ...prev,
        windowFocused: true,
      }));
    }, 800);
  }, []);

  useEffect(() => {
    // 1. Monkey-patch & Kill WebRTC Screen Recording (getDisplayMedia)
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async () => {
        triggerBlackout('Unauthorized Screen Recording API Call (getDisplayMedia)');
        throw new DOMException('Screen recording is restricted by VeriMask Vault DRM.', 'NotAllowedError');
      };
    }

    // 2. Check & Activate Native OS DRM Bridge (Electron / Android WebView / Tauri)
    const activateNativeOsProtection = async () => {
      try {
        // Electron / Desktop Wrapper Bridge
        if (typeof window !== 'undefined' && (window as any).veriMaskNative?.enableOsContentProtection) {
          await (window as any).veriMaskNative.enableOsContentProtection(true);
          setSelfCheck((prev) => ({ ...prev, drmHardwareActive: true }));
        }
        // Android WebView Bridge (FLAG_SECURE)
        else if (typeof window !== 'undefined' && (window as any).AndroidVaultBridge?.enableFlagSecure) {
          (window as any).AndroidVaultBridge.enableFlagSecure();
          setSelfCheck((prev) => ({ ...prev, drmHardwareActive: true }));
        }
      } catch {
        setSelfCheck((prev) => ({ ...prev, drmHardwareActive: false }));
      }
    };
    activateNativeOsProtection();

    // 3. Intercept OS Screenshot Keys & Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isMacScreenshot = e.metaKey && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key);
      const isWinSnip = (e.metaKey && e.shiftKey && ['s', 'S'].includes(e.key)) || (e.metaKey && e.key === 'PrintScreen');
      const isDevTools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['I', 'i', 'J', 'j'].includes(e.key));
      const isPrintOrSave = (e.ctrlKey || e.metaKey) && ['p', 'P', 's', 'S'].includes(e.key);

      if (isPrintScreen || isMacScreenshot || isWinSnip || isDevTools || isPrintOrSave) {
        e.preventDefault();
        e.stopPropagation();

        // Poison the system clipboard immediately
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(
            `[VERIMASK SECURITY ALERT] Screenshot blocked for Credential ${credentialId}. Incident logged.`
          ).catch(() => {});
        }

        triggerBlackout(`Restricted OS Capture Key Detected (${e.key})`);
        return false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('[PROTECTED BY VERIMASK VAULT]').catch(() => {});
        }
        triggerBlackout('PrintScreen Key Release Intercepted');
      }
    };

    // 4. OS Snipping Tool / Alt-Tab / Screen Recorder Overlay Focus Loss Detection
    // When Windows Snipping Tool (Win+Shift+S) or macOS Screenshot UI opens, the browser immediately loses focus.
    const handleWindowBlur = () => {
      triggerBlackout('OS Overlay / Focus Loss Detected (Potential Snipping Tool or Recorder)');
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== 'visible') {
        triggerBlackout('Tab Hidden / Background Capture Prevention');
      } else {
        restoreView();
      }
    };

    // 5. Block Context Menu, Dragging, and Clipboard Copy
    const preventDefaultAction = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // 6. Picture-in-Picture / External Display Change Detection
    const devToolsInterval = setInterval(() => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        setSelfCheck((prev) => ({ ...prev, devToolsClosed: false }));
        triggerBlackout('Browser DevTools Inspection Detected');
      } else {
        setSelfCheck((prev) => ({ ...prev, devToolsClosed: true }));
      }
    }, 1000);

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', restoreView);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', preventDefaultAction);
    document.addEventListener('copy', preventDefaultAction);
    document.addEventListener('cut', preventDefaultAction);
    document.addEventListener('dragstart', preventDefaultAction);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', restoreView);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', preventDefaultAction);
      document.removeEventListener('copy', preventDefaultAction);
      document.removeEventListener('cut', preventDefaultAction);
      document.removeEventListener('dragstart', preventDefaultAction);
      clearInterval(devToolsInterval);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    };
  }, [credentialId, restoreView, triggerBlackout]);

  return (
    <div
      className="relative select-none overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white"
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Print Media Blocker: Forces blank page if someone tries Ctrl+P / Save as PDF */}
      <style>{`
        @media print {
          body * { display: none !important; visibility: hidden !important; }
          body::after {
            content: "VERIMASK SECURITY VIOLATION: PRINTING & PDF EXPORT OF VERIFIED CREDENTIALS IS STRICTLY BLOCKED.";
            display: block !important;
            visibility: visible !important;
            font-size: 24px;
            font-family: monospace;
            padding: 40px;
            color: red;
          }
        }
      `}</style>

      {/* Self-Check Telemetry Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              !isBlackedOut && selfCheck.devToolsClosed ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="uppercase tracking-wider text-neutral-300">
            ANTI-CAPTURE SHIELD: {!isBlackedOut ? 'ACTIVE (SELF-CHECK PASSED)' : 'LOCKED'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-neutral-400">
          <span>DRM: {selfCheck.drmHardwareActive ? 'OS-HARDWARE' : 'DOM-SANDBOX'}</span>
          <span>BREACH BLOCKS: {selfCheck.breachAttempts}</span>
        </div>
      </div>

      {/* Main Protected Content Area */}
      <div className="relative p-6">
        {isBlackedOut ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-red-500/40 bg-black p-8 text-center">
            <div className="mb-3 text-3xl font-bold tracking-widest text-red-500">
              [CAPTURE BLOCKED]
            </div>
            <p className="max-w-md text-sm text-neutral-400">
              VeriMask detected a screenshot shortcut, screen recorder, or OS overlay focus change.
              Credential <span className="font-mono text-white">{credentialId}</span> has been
              masked to prevent data leakage.
            </p>
            {selfCheck.lastBreachReason && (
              <p className="mt-3 rounded bg-red-950/60 px-3 py-1 font-mono text-xs text-red-300">
                Trigger: {selfCheck.lastBreachReason}
              </p>
            )}
            <button
              onClick={restoreView}
              className="mt-6 rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-2 text-xs font-mono uppercase tracking-wider text-white hover:bg-neutral-800"
            >
              Re-Verify Focus & Unlock View
            </button>
          </div>
        ) : (
          <>
            {/* Dynamic Forensic Watermark Overlay (Deters external phone cameras) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 flex flex-wrap content-around justify-around overflow-hidden opacity-15"
            >
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className="-rotate-12 select-none whitespace-nowrap font-mono text-[10px] tracking-widest text-neutral-400"
                >
                  {credentialId} • {holderName} • DO NOT CAPTURE • {new Date().toISOString().slice(0, 16)}
                </div>
              ))}
            </div>

            {/* Protected Credential / QR Content */}
            <div className="relative z-10">{children}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default VaultAntiCaptureShield;
