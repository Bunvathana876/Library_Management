import type { Book } from '@/types/api';
import { isSafeCoverUrl } from '@/utils/isbn';

/** Only use the catalog's validated cover; never substitute unrelated artwork. */
export function getPrimaryBookCoverUrl(book: Pick<Book, 'coverUrl'>): string | null {
  return isSafeCoverUrl(book.coverUrl);
}
