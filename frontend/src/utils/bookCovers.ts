import type { Book } from '@/types/api';
import { isSafeCoverUrl } from '@/utils/isbn';

const COVER_PURPLE_MOUNTAINS = '/images/catalog/cover-purple-mountains.webp';
const COVER_GREEN_FOREST = '/images/catalog/cover-green-forest.webp';

/**
 * Return a validated external/local cover URL from book metadata when available.
 */
export function getPrimaryBookCoverUrl(book: Pick<Book, 'coverUrl'>): string | null {
  return isSafeCoverUrl(book.coverUrl);
}

/**
 * Resolve the cover artwork asset for a catalog book record.
 */
export function getBookCoverArtwork(book: Book): string {
  const normalizedTitle = book.title.trim().toLowerCase();
  if (normalizedTitle.includes('learning spring boot')) {
    return COVER_PURPLE_MOUNTAINS;
  }
  if (normalizedTitle.includes('spring in action')) {
    return COVER_GREEN_FOREST;
  }
  return book.id % 2 === 0 ? COVER_PURPLE_MOUNTAINS : COVER_GREEN_FOREST;
}
