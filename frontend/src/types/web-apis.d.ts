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
