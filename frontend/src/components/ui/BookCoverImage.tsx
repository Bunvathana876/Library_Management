import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { Book } from '@/types/api';
import { getPrimaryBookCoverUrl } from '@/utils/bookCovers';

interface BookCoverImageProps {
  book: Pick<Book, 'id' | 'title' | 'author' | 'coverUrl' | 'isbn'>;
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
  const imgRef = useRef<HTMLImageElement>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 1 && el.naturalHeight > 1) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [book.id, primaryUrl]);

  const resolvedSrc = primaryUrl && !useFallback ? primaryUrl : null;
  const isExternal = resolvedSrc?.startsWith('http://') || resolvedSrc?.startsWith('https://');

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!useFallback && primaryUrl) {
      const img = e.currentTarget;
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
        setUseFallback(true);
        return;
      }
      setLoaded(true);
    }
  };

  const handleError = () => {
    if (!useFallback && primaryUrl) {
      setUseFallback(true);
    }
  };

  const placeholder = (
    <span
      className={`${className ?? ''} book-cover-placeholder`.trim()}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <span className="cover-placeholder-title">{book.title}</span>
      <span className="cover-placeholder-author">{book.author}</span>
      <span className="cover-placeholder-note">
        {resolvedSrc && !loaded ? 'Loading cover' : 'Cover unavailable'}
      </span>
    </span>
  );

  if (!resolvedSrc) {
    return placeholder;
  }

  return (
    <>
      {!loaded ? placeholder : null}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        referrerPolicy={isExternal ? 'no-referrer' : undefined}
        className={loaded ? className : undefined}
        style={
          loaded
            ? undefined
            : {
                position: 'absolute',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none',
              }
        }
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
