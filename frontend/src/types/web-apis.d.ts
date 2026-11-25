/// <reference types="temporal-polyfill/global" />

interface Document {
  ariaNotify?: (announcement: string, options?: { priority?: 'normal' | 'high' }) => void;
}

interface HTMLDialogElement {
  closedBy?: string;
  requestClose?: (returnValue?: string) => void;
}

interface HTMLElement {
  showPopover?: () => void;
  hidePopover?: () => void;
}

interface DetectedBarcode {
  rawValue: string;
  format?: string;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
