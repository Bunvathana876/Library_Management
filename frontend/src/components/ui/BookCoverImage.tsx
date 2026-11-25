import { useEffect, useState, type SyntheticEvent } from 'react';
import type { Book } from '@/types/api';
import { getBookCoverArtwork, getPrimaryBookCoverUrl } from '@/utils/bookCovers';

interface BookCoverImageProps {
  book: Book;
  width: number;
  height: number;
  className?: string;
  loading?: 'eager' | 'lazy';
  alt?: string;
}

export function BookCoverImage({
  book,
  width,
  height,
  className,
  loading,
  alt = '',
}: BookCoverImageProps) {
  const primaryUrl = getPrimaryBookCoverUrl(book);
  const fallbackUrl = getBookCoverArtwork(book);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [book.id, primaryUrl]);

  const resolvedSrc = primaryUrl && !useFallback ? primaryUrl : fallbackUrl;
  const isExternal = resolvedSrc.startsWith('http://') || resolvedSrc.startsWith('https://');

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!useFallback && primaryUrl) {
      const img = e.currentTarget;
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
        setUseFallback(true);
      }
    }
  };

  const handleError = () => {
    if (!useFallback && primaryUrl) {
      setUseFallback(true);
    }
  };

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      referrerPolicy={isExternal ? 'no-referrer' : undefined}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
