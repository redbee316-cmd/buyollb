import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Install Buyoll App"
        style={{
          background: '#ff5500',
          color: '#fff',
          border: '1px solid rgba(255, 102, 0, 0.35)',
          borderRadius: '10px',
          padding: '6px 10px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          flexShrink: 0,
        }}
      >
        <Download size={14} />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install Buyoll App on iOS"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            color: '#231409',
            border: '1px solid rgba(255, 102, 0, 0.35)',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="mod"
            role="dialog"
            aria-modal="true"
            aria-label="Install Buyoll on iPhone or iPad"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
          >
            <div>
              <h3>Install Buyoll App</h3>
              <p className="mu" style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.6 }}>
                1. Tap the <b>Share</b> button in Safari&apos;s toolbar.
                <br />
                2. Scroll down and tap <b>Add to Home Screen</b>.
              </p>
              <button
                type="button"
                className="btn y bl"
                style={{ marginTop: '12px' }}
                onClick={() => setShowIOSGuide(false)}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '74px',
        left: '14px',
        zIndex: 45,
        background: '#191919',
        color: '#ffd000',
        borderRadius: '10px',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
      }}
    >
      <WifiOff size={14} />
      <span>Offline — showing cached marketplace assets</span>
    </div>
  );
};
