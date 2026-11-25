import { useEffect, useState } from 'react';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

export function QrCodeCanvas({
  value,
  size = 112,
  label,
  className,
}: QrCodeCanvasProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setSvgMarkup('');
    if (!value) return;

    import('@zxing/browser')
      .then(({ BrowserQRCodeSvgWriter }) => {
        if (cancelled) return;
        const writer = new BrowserQRCodeSvgWriter();
        const svgEl = writer.write(value, size, size);
        svgEl.setAttribute('role', 'img');
        svgEl.setAttribute('aria-label', label || `QR code for ${value}`);
        svgEl.setAttribute('width', String(size));
        svgEl.setAttribute('height', String(size));
        setSvgMarkup(svgEl.outerHTML);
      })
      .catch(() => {
        if (!cancelled) setSvgMarkup('');
      });

    return () => {
      cancelled = true;
    };
  }, [value, size, label]);

  if (!svgMarkup) {
    return (
      <div
        className={`qr-plaque-placeholder mono ${className ?? ''}`.trim()}
        style={{ width: size, height: size }}
        aria-label={label || `QR code for ${value}`}
      >
        {value}
      </div>
    );
  }

  return (
    <div
      className={`qr-plaque ${className ?? ''}`.trim()}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
