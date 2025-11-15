"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { BrowserMultiFormatReader } from "@zxing/browser";

type BarcodeScannerProps = {
  active: boolean;
  onScan: (result: string) => void;
  onError?: (message: string) => void;
};

export function BarcodeScanner({ active, onScan, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
      return;
    }

    let controls: IScannerControls | null = null;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setPermissionError(null);

    (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, err) => {
            if (result) {
              onScan(result.getText());
            }
            if (err && err.name !== "NotFoundException") {
              onError?.(err.message);
            }
          }
        );
        controlsRef.current = controls;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to start barcode scanner.";
        setPermissionError(message);
        onError?.(message);
      }
    })();

    return () => {
      controls?.stop();
      controlsRef.current = null;
    };
  }, [active, onError, onScan]);

  if (!active) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-white">
      {permissionError ? (
        <p className="text-sm font-medium text-rose-200">{permissionError}</p>
      ) : (
        <video
          ref={videoRef}
          className="aspect-video w-full rounded-lg border border-white/10 bg-black/60 object-cover"
          autoPlay
          muted
        />
      )}
      <p className="mt-2 text-center text-xs text-white/60">
        Align the barcode within the frame to capture automatically.
      </p>
    </div>
  );
}
