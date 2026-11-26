import 'temporal-polyfill/global';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { BorrowBookModal } from '../BorrowBookModal';
import { ToastProvider } from '@/context/ToastContext';
import { booksApi } from '@/api/booksApi';
import { loansApi } from '@/api/loansApi';
import { ApiError } from '@/utils/errors';
import type { Book, BookCopyResponse, Member, LoanResponse } from '@/types/api';

let container: HTMLDivElement;
let root: Root;
const book: Book = { id: 1, title: 'Concurrency', author: 'QA', publicationYear: 2026, available: true };
const member: Member = { id: 2, fullName: 'Reader', email: 'reader@example.test', active: true };
const copies = [11,12].map(id => ({ id, bookId: 1, barcode: `COPY-${id}`, status: 'AVAILABLE' })) as BookCopyResponse[];

beforeAll(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  vi.spyOn(booksApi, 'listCopies').mockResolvedValue(copies);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
async function renderModal() {
  const onClose=vi.fn(), onBorrowed=vi.fn();
  await act(async () => root.render(<ToastProvider><BorrowBookModal open books={[book]} members={[member]} activeHolds={[]} onClose={onClose} onBorrowed={onBorrowed} /></ToastProvider>));
  return { onClose, onBorrowed };
}
async function submit() {
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
it('submits the selected physical copy and reports successful checkout', async () => {
  const saved={ id: 99, bookTitle: book.title, memberName: member.fullName, copyBarcode: 'COPY-12' } as LoanResponse;
  const borrow=vi.spyOn(loansApi,'borrowBook').mockResolvedValue(saved);
  const callbacks=await renderModal();
  await act(async () => {
    const select=container.querySelector('#borrow-copy-select') as HTMLSelectElement;
    select.value='12'; select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await submit();
  expect(borrow).toHaveBeenCalledWith({bookId:1,memberId:2,copyId:12});
  expect(callbacks.onBorrowed).toHaveBeenCalledWith(saved);
  expect(callbacks.onClose).toHaveBeenCalledOnce();
});
it('keeps the modal open and displays a server borrowing-limit conflict', async () => {
  vi.spyOn(loansApi,'borrowBook').mockRejectedValue(new ApiError(409,'Borrowing limit reached (5/5 active loans)'));
  const callbacks=await renderModal();
  await submit();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Borrowing limit reached');
  expect(callbacks.onClose).not.toHaveBeenCalled();
  expect(callbacks.onBorrowed).not.toHaveBeenCalled();
});
