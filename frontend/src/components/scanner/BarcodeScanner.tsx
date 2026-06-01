'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onScan: (value: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let reader: import('@zxing/browser').BrowserMultiFormatReader | null = null;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;
        if (!deviceId || !videoRef.current) {
          setError('No camera found');
          return;
        }
        reader.decodeFromVideoDevice(deviceId, videoRef.current, result => {
          if (!active || !result) return;
          onScan(result.getText());
          onClose();
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Camera access denied');
      }
    })();

    return () => {
      active = false;
    };
  }, [onClose, onScan]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-navy">Scan barcode / SKU</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-navy">
            ×
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <video ref={videoRef} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />
        )}
        <p className="mt-2 text-xs text-muted">Point camera at product barcode or QR code</p>
      </div>
    </div>
  );
}
