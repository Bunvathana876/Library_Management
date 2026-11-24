/**
 * Synchronizes :user-invalid / validity state with ARIA attributes and error descriptions
 * without reading hidden errors prematurely on page load.
 */
export function linkFieldError(el: HTMLElement, shown: boolean): void {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const ids = (el.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length > 0) {
    el.setAttribute('aria-describedby', ids.join(' '));
  } else {
    el.removeAttribute('aria-describedby');
  }
}

export function installFormValidationAria(root: HTMLElement): () => void {
  const supportsUserInvalid =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('selector(:user-invalid)');

  const dirtyState = new WeakMap<HTMLElement, { interacted: boolean; blurred: boolean }>();

  const syncControl = (el: HTMLElement, invalid: boolean, validClass = false) => {
    if (!supportsUserInvalid) {
      el.classList.toggle('user-invalid-fallback', invalid);
      el.classList.toggle('user-valid-fallback', validClass && !invalid);
    }
    el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    linkFieldError(el, invalid);
  };

  root.querySelectorAll<HTMLElement>('input, select, textarea').forEach((el) => {
    if (!el.hasAttribute('aria-invalid')) {
      el.setAttribute('aria-invalid', 'false');
    }
  });

  const onBlur = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!target?.matches?.('input, select, textarea')) return;

    if (supportsUserInvalid) {
      syncControl(target, target.matches(':user-invalid'));
      return;
    }

    const state = dirtyState.get(target) ?? { interacted: false, blurred: false };
    state.blurred = true;
    dirtyState.set(target, state);
    if (state.interacted) {
      syncControl(target, !target.validity.valid, true);
    }
  };

  const onInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!target?.matches?.('input, select, textarea')) return;

    if (supportsUserInvalid) {
      if (target.getAttribute('aria-invalid') === 'true' || target.matches(':user-invalid')) {
        syncControl(target, target.matches(':user-invalid'));
      }
      return;
    }

    const state = dirtyState.get(target) ?? { interacted: false, blurred: false };
    state.interacted = true;
    dirtyState.set(target, state);
    if (state.blurred) {
      syncControl(target, !target.validity.valid, true);
    }
  };

  const onInvalid = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!target?.matches?.('input, select, textarea')) return;
    if (!supportsUserInvalid) {
      dirtyState.set(target, { interacted: true, blurred: true });
    }
    syncControl(target, true, false);
  };

  const onReset = (e: Event) => {
    const form = e.target as HTMLFormElement;
    window.setTimeout(() => {
      for (const el of Array.from(form.elements)) {
        if (el instanceof HTMLElement && el.matches('input, select, textarea')) {
          dirtyState.delete(el);
          el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          el.setAttribute('aria-invalid', 'false');
          linkFieldError(el, false);
        }
      }
    }, 0);
  };

  root.addEventListener('blur', onBlur, true);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('invalid', onInvalid, true);
  root.addEventListener('reset', onReset, true);

  return () => {
    root.removeEventListener('blur', onBlur, true);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onInput);
    root.removeEventListener('invalid', onInvalid, true);
    root.removeEventListener('reset', onReset, true);
  };
}
