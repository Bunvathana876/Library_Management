import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmation } from '@/hooks/useConfirmation';

describe('confirmation gates', () => {
  let container: HTMLDivElement;
  let root: Root;
  const mutate = vi.fn();
  function Harness() {
    const { confirm, confirmationDialog } = useConfirmation();
    return <><button onClick={async () => {
      if (await confirm({ title: 'Record payment?', message: 'Record $2 for Loan #3?', confirmLabel: 'Record payment' })) mutate();
    }}>Pay</button>{confirmationDialog}</>;
  }
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container); mutate.mockClear();
    act(() => root.render(<StrictMode><Harness /></StrictMode>));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  async function click(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === text)!;
    await act(async () => button.click());
  }
  it('never mutates before approval or after cancellation, and confirms exactly once', async () => {
    await click('Pay'); expect(mutate).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe('Cancel');
    await click('Cancel'); expect(mutate).not.toHaveBeenCalled();
    await click('Pay'); await click('Record payment'); expect(mutate).toHaveBeenCalledTimes(1);
    expect(container.querySelector('dialog')).toBeNull();
  });
  it('cancels a pending operation if its owner unmounts', async () => {
    await click('Pay'); await act(async () => root.render(<div />));
    expect(mutate).not.toHaveBeenCalled();
  });
});
