'use client';

import { useEffect, useRef, useState } from 'react';

type ScanCameraButtonProps = {
  label?: string;
  onScan: (value: string) => void;
  className?: string;
};

export function ScanCameraButton({
  label = 'Camera Scan',
  onScan,
  className = '',
}: ScanCameraButtonProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let frameId = 0;

    async function startCamera() {
      if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
        setStatus('Camera scanning is not available in this browser. Use the scan input instead.');
        return;
      }

      const BarcodeDetectorCtor = (window as unknown as {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        setStatus('Camera barcode detection is not available here. Use a Bluetooth scanner or type the code.');
        return;
      }

      try {
        setStatus('Starting camera...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetectorCtor({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'],
        });

        scanningRef.current = true;
        setStatus('Point the camera at the barcode.');

        async function scanFrame() {
          if (!scanningRef.current || !videoRef.current) return;

          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();

            if (value) {
              onScan(value);
              setStatus(`Scanned ${value}`);
              setOpen(false);
              return;
            }
          } catch {
            setStatus('Could not read a barcode yet. Keep the code centered.');
          }

          frameId = window.setTimeout(scanFrame, 350);
        }

        scanFrame();
      } catch {
        setStatus('Camera permission was blocked or no camera was found. Use the scan input instead.');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      scanningRef.current = false;
      window.clearTimeout(frameId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [onScan, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50'
        }
      >
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/60 p-3 sm:items-center sm:justify-center">
          <div className="w-full rounded-md border border-slate-300 bg-white p-4 shadow-xl sm:max-w-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Camera Scan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keyboard scanners still work in the regular scan field.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-slate-300 bg-slate-950">
              <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline />
            </div>

            <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {status || 'Opening camera...'}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
