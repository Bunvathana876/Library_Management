import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, X } from 'lucide-react';
import { extractIsbnFromBarcode } from '@/utils/isbn';

interface IsbnBarcodeScannerProps {
  open: boolean;
  onDetected: (isbn: string) => void;
  onClose: () => void;
}

const TARGET_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const;

export function IsbnBarcodeScanner({ open, onDetected, onClose }: IsbnBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [statusText, setStatusText] = useState('Starting camera…');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    let mediaStream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let detectedOnce = false;

    const cleanupStream = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (zxingControls) {
        try {
          zxingControls.stop();
        } catch {
          // Ignore teardown errors
        }
        zxingControls = null;
      }
      if (mediaStream) {
        for (const track of mediaStream.getTracks()) {
          track.stop();
        }
        mediaStream = null;
      }
      const video = videoRef.current;
      if (video) {
        const attachedStream = video.srcObject as MediaStream | null;
        if (attachedStream) {
          for (const track of attachedStream.getTracks()) {
            track.stop();
          }
        }
        video.srcObject = null;
      }
    };

    const handleDecodedValue = (rawValue: string) => {
      if (cancelled || detectedOnce) return;
      const isbn = extractIsbnFromBarcode(rawValue);
      if (!isbn) return;
      detectedOnce = true;
      cleanupStream();
      onDetectedRef.current(isbn);
    };

    const startScanner = async () => {
      setErrorText(null);
      setStatusText('Starting camera…');

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setErrorText(
          'Camera access requires a secure browser context (HTTPS or localhost). You can still type, paste, or use a USB/Bluetooth barcode scanner in the ISBN box.',
        );
        return;
      }

      const videoEl = videoRef.current;
      if (!videoEl) {
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      try {
        if (typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function') {
          let formats: string[] = [...TARGET_FORMATS];
          if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
            try {
              const supported = await window.BarcodeDetector.getSupportedFormats();
              const filtered = TARGET_FORMATS.filter((fmt) => supported.includes(fmt));
              if (filtered.length > 0) {
                formats = filtered;
              }
            } catch {
              // Fall back to default TARGET_FORMATS
            }
          }

          if (cancelled) return;
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            cleanupStream();
            return;
          }

          videoEl.srcObject = mediaStream;
          await videoEl.play();
          if (cancelled) {
            cleanupStream();
            return;
          }

          const detector = new window.BarcodeDetector({ formats });
          setStatusText('Align the ISBN barcode on the back cover inside the frame.');

          let lastCheckAt = 0;
          const scanFrame = async (timestamp: number) => {
            if (cancelled || detectedOnce) return;
            if (
              timestamp - lastCheckAt >= 120 &&
              videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            ) {
              lastCheckAt = timestamp;
              try {
                const barcodes = await detector.detect(videoEl);
                for (const code of barcodes) {
                  if (code.rawValue) {
                    handleDecodedValue(code.rawValue);
                    if (detectedOnce) return;
                  }
                }
              } catch {
                // Keep scanning next frame
              }
            }
            if (!cancelled && !detectedOnce) {
              rafId = window.requestAnimationFrame((ts) => {
                void scanFrame(ts);
              });
            }
          };

          rafId = window.requestAnimationFrame((ts) => {
            void scanFrame(ts);
          });
          return;
        }

        // Cross-browser fallback (Safari / Firefox) via lazy-loaded ZXing 1D barcode reader
        const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] =
          await Promise.all([import('@zxing/browser'), import('@zxing/library')]);

        if (cancelled) return;

        const hints = new Map<unknown, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
        ]);

        const reader = new BrowserMultiFormatOneDReader(
          hints as Map<import('@zxing/library').DecodeHintType, unknown>,
        );
        setStatusText('Align the ISBN barcode on the back cover inside the frame.');

        const controls = await reader.decodeFromConstraints(constraints, videoEl, (result) => {
          if (result) {
            handleDecodedValue(result.getText());
          }
        });

        if (cancelled || detectedOnce) {
          controls.stop();
          cleanupStream();
          return;
        }
        zxingControls = controls;
      } catch (err) {
        if (cancelled) return;
        cleanupStream();
        const message = err instanceof Error ? err.message : '';
        if (
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        ) {
          setErrorText(
            'Camera permission was denied. Allow camera access or use a USB/Bluetooth barcode scanner in the ISBN field.',
          );
        } else if (
          err instanceof DOMException &&
          (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
        ) {
          setErrorText(
            'No camera device was detected. You can type, paste, or scan with a USB/Bluetooth scanner directly in the ISBN field.',
          );
        } else {
          setErrorText(
            message
              ? `Could not start camera scanner (${message}). Type or paste the ISBN above instead.`
              : 'Could not start camera scanner. Type or paste the ISBN above instead.',
          );
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      cleanupStream();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div id="isbn-scanner-panel" className="isbn-scanner-panel">
      <div className="isbn-scanner-header">
        <div className="isbn-scanner-title-group">
          <Camera size={16} aria-hidden="true" />
          <span>Camera Barcode Scanner</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          aria-label="Close barcode scanner"
        >
          <X size={15} aria-hidden="true" />
          <span>Stop</span>
        </button>
      </div>

      {errorText ? (
        <div className="alert alert-warning isbn-scanner-error" role="alert">
          <CameraOff size={17} aria-hidden="true" className="alert-icon" />
          <span>{errorText}</span>
        </div>
      ) : (
        <>
          <div className="isbn-scanner-viewport">
            <video ref={videoRef} playsInline muted autoPlay className="isbn-scanner-video" />
            <div className="isbn-scanner-reticle" aria-hidden="true">
              <span className="isbn-reticle-corner isbn-reticle-tl" />
              <span className="isbn-reticle-corner isbn-reticle-tr" />
              <span className="isbn-reticle-corner isbn-reticle-bl" />
              <span className="isbn-reticle-corner isbn-reticle-br" />
            </div>
          </div>
          <p className="field-hint">{statusText}</p>
        </>
      )}
    </div>
  );
}
