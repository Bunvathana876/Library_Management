import type { Book } from '@/types/api';

const COVER_PURPLE_MOUNTAINS = '/images/catalog/cover-purple-mountains.webp';
const COVER_GREEN_FOREST = '/images/catalog/cover-green-forest.webp';

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
