import { useEffect, useId, useMemo, useState, type RefObject } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookGridSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import type { Book } from '@/types/api';
import { getBookCoverArtwork } from '@/utils/bookCovers';
import { formatCallNumber } from '@/utils/formatting';

interface BooksPageProps {
  books: Book[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  loading: boolean;
  errorMsg: string | null;
  onRetry: () => void;
  onAddBook: () => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (book: Book) => void;
  onInspectBook: (bookId: number) => void;
  onBorrowBook: (book: Book) => void;
}

type AvailabilityFilter = 'all' | 'available' | 'borrowed';
type SortOption = 'title-asc' | 'title-desc' | 'year-desc' | 'year-asc';
type ViewMode = 'grid' | 'table';

const PAGE_SIZE = 6;

function getSortLabel(sortBy: SortOption): string {
  switch (sortBy) {
    case 'title-asc':
      return 'Title (A–Z)';
    case 'title-desc':
      return 'Title (Z–A)';
    case 'year-desc':
      return 'Newest publication year';
    case 'year-asc':
      return 'Oldest publication year';
  }
}

export function BooksPage({
  books,
  searchQuery,
  onSearchChange,
  searchInputRef,
  loading,
  errorMsg,
  onRetry,
  onAddBook,
  onEditBook,
  onDeleteBook,
  onInspectBook,
  onBorrowBook,
}: BooksPageProps) {
  const { isStaff } = useAuth();
  const tableCaptionId = useId();
  const statusSelectId = useId();
  const yearSelectId = useId();
  const sortSelectId = useId();

  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('title-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');

  // Reset pagination when global/topbar search updates
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalBooks = books.length;
  const availableCount = useMemo(() => books.filter((book) => book.available).length, [books]);
  const checkedOutCount = totalBooks - availableCount;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const book of books) {
      if (Number.isFinite(book.publicationYear)) {
        years.add(book.publicationYear);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [books]);

  // If the selected year disappears (e.g. a temporary record was deleted), fall back cleanly
  useEffect(() => {
    if (selectedYear !== 'all' && !availableYears.includes(Number(selectedYear))) {
      setSelectedYear('all');
    }
  }, [availableYears, selectedYear]);

  const filteredBooks = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    const subset = books.filter((book) => {
      if (availability === 'available' && !book.available) return false;
      if (availability === 'borrowed' && book.available) return false;
      if (selectedYear !== 'all' && String(book.publicationYear) !== selectedYear) return false;

      if (trimmedQuery.length > 0) {
        const callNumber = formatCallNumber(book.id).toLowerCase();
        const recordId = String(book.id);
        const matchesText =
          book.title.toLowerCase().includes(trimmedQuery) ||
          book.author.toLowerCase().includes(trimmedQuery) ||
          callNumber.includes(trimmedQuery) ||
          `#${recordId}`.includes(trimmedQuery) ||
          recordId === trimmedQuery;
        if (!matchesText) return false;
      }

      return true;
    });

    return [...subset].sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'year-desc':
          return b.publicationYear - a.publicationYear || a.title.localeCompare(b.title);
        case 'year-asc':
          return a.publicationYear - b.publicationYear || a.title.localeCompare(b.title);
      }
    });
  }, [books, availability, selectedYear, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedBooks = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredBooks.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredBooks, safePage]);

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );

  const rangeStart = filteredBooks.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredBooks.length);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || availability !== 'all' || selectedYear !== 'all';

  const clearAllFilters = () => {
    onSearchChange('');
    setAvailability('all');
    setSelectedYear('all');
    setCurrentPage(1);
    setStatusAnnouncement('Cleared all catalog filters.');
  };

  return (
    <div className="catalog-page">
      {/* Screen-reader status announcement kept mounted in DOM for filter/sort changes */}
      <p role="status" className="visually-hidden">
        {statusAnnouncement}
      </p>

      {/* Catalog Hero Banner */}
      <section className="catalog-hero" aria-label="Library catalog summary">
        <div className="catalog-hero-content">
          <div className="catalog-hero-eyebrow">
            <BookOpen size={15} aria-hidden="true" />
            <span>Library Catalog</span>
          </div>

          <h2 className="catalog-hero-title">Explore Our Collection</h2>
          <p className="catalog-hero-desc">
            Browse, search, and discover books available in the library
          </p>

          <div className="catalog-hero-stats" aria-label="Catalog availability metrics">
            <div className="catalog-hero-stat">
              <span className="catalog-hero-stat-icon" aria-hidden="true">
                <BookOpen size={16} />
              </span>
              <div className="catalog-hero-stat-text">
                <strong className="catalog-hero-stat-value tabular-nums">{totalBooks}</strong>
                <span className="catalog-hero-stat-label">Total Books</span>
              </div>
            </div>

            <span className="catalog-hero-stat-divider" aria-hidden="true" />

            <div className="catalog-hero-stat">
              <span className="catalog-hero-stat-icon" aria-hidden="true">
                <Layers size={16} />
              </span>
              <div className="catalog-hero-stat-text">
                <strong className="catalog-hero-stat-value tabular-nums">{availableCount}</strong>
                <span className="catalog-hero-stat-label">Available</span>
              </div>
            </div>

            <span className="catalog-hero-stat-divider" aria-hidden="true" />

            <div className="catalog-hero-stat">
              <span className="catalog-hero-stat-icon" aria-hidden="true">
                <RefreshCw size={16} />
              </span>
              <div className="catalog-hero-stat-text">
                <strong className="catalog-hero-stat-value tabular-nums">{checkedOutCount}</strong>
                <span className="catalog-hero-stat-label">Checked Out</span>
              </div>
            </div>
          </div>
        </div>

        <div className="catalog-hero-artwork" aria-hidden="true">
          <img
            src="/images/catalog/catalog-hero.webp"
            alt=""
            width={352}
            height={221}
            fetchPriority="high"
            decoding="async"
            className="catalog-hero-img"
          />
        </div>
      </section>

      {/* Search & Filter Toolbar */}
      <section className="card catalog-toolbar" aria-label="Catalog search and filters">
        <div className="catalog-search-wrap">
          <Search size={16} className="catalog-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            className="input-control catalog-search-input"
            enterKeyHint="search"
            aria-label="Search books by title, author, or catalog ID"
            placeholder="Search by title, author, or CAT-ID"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              className="catalog-search-clear"
              onClick={() => {
                onSearchChange('');
                setCurrentPage(1);
              }}
              aria-label="Clear search query"
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="catalog-toolbar-controls">
          <div className="catalog-select-wrap">
            <label htmlFor={statusSelectId} className="visually-hidden">
              Filter by status
            </label>
            <select
              id={statusSelectId}
              name="catalog-status"
              className="catalog-select catalog-select-status"
              value={availability}
              onChange={(e) => {
                const next = e.target.value as AvailabilityFilter;
                setAvailability(next);
                setCurrentPage(1);
                setStatusAnnouncement(`Filtered catalog status to ${next}.`);
              }}
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="borrowed">Borrowed</option>
            </select>
            <ChevronDown size={15} className="catalog-select-chevron" aria-hidden="true" />
          </div>

          <div className="catalog-select-wrap">
            <label htmlFor={yearSelectId} className="visually-hidden">
              Filter by publication year
            </label>
            <select
              id={yearSelectId}
              name="catalog-year"
              className="catalog-select catalog-select-year"
              value={selectedYear}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedYear(next);
                setCurrentPage(1);
                setStatusAnnouncement(
                  next === 'all'
                    ? 'Showing all publication years.'
                    : `Filtered publication year to ${next}.`,
                );
              }}
            >
              <option value="all">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="catalog-select-chevron" aria-hidden="true" />
          </div>

          <div className="catalog-select-wrap">
            <label htmlFor={sortSelectId} className="visually-hidden">
              Sort catalog books
            </label>
            <select
              id={sortSelectId}
              name="catalog-sort"
              className="catalog-select catalog-select-sort"
              value={sortBy}
              onChange={(e) => {
                const next = e.target.value as SortOption;
                setSortBy(next);
                setCurrentPage(1);
                setStatusAnnouncement(`Sorted by ${getSortLabel(next)}.`);
              }}
            >
              <option value="title-asc">Title (A–Z)</option>
              <option value="title-desc">Title (Z–A)</option>
              <option value="year-desc">Newest publication year</option>
              <option value="year-asc">Oldest publication year</option>
            </select>
            <ChevronDown size={15} className="catalog-select-chevron" aria-hidden="true" />
          </div>

          <div className="catalog-view-toggle" role="group" aria-label="Catalog view mode">
            <button
              type="button"
              className="catalog-view-btn"
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
              title="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="catalog-view-btn"
              aria-pressed={viewMode === 'table'}
              aria-label="List view"
              title="List view"
              onClick={() => setViewMode('table')}
            >
              <List size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {hasActiveFilters && filteredBooks.length > 0 ? (
        <div className="filter-summary-bar">
          <span>
            Filtered to <strong>{filteredBooks.length}</strong> book
            {filteredBooks.length === 1 ? '' : 's'}
            {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
            {availability !== 'all' ? ` · ${availability}` : ''}
            {selectedYear !== 'all' ? ` · ${selectedYear}` : ''}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
            Clear Filters
          </button>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="alert alert-danger alert-row" role="alert">
          <span>{errorMsg}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {/* Main Content Area: Loading / Empty / Grid / List */}
      {loading && books.length === 0 ? (
        viewMode === 'grid' ? (
          <BookGridSkeleton count={4} />
        ) : (
          <TableSkeleton rows={5} label="Loading books catalog table" />
        )
      ) : filteredBooks.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title={
            books.length === 0
              ? 'Catalog is currently empty'
              : searchQuery.trim()
                ? 'No matching books found'
                : 'No books match your filters'
          }
          description={
            books.length === 0
              ? 'Add a book record to start populating the library catalog.'
              : searchQuery.trim()
                ? `No books matched "${searchQuery.trim()}". Try another search term or clear active filters.`
                : 'No books match the selected status or publication year filter.'
          }
          action={
            hasActiveFilters ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
                Clear Filters
              </button>
            ) : isStaff ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={onAddBook}>
                <Plus size={15} aria-hidden="true" />
                <span>Add Book</span>
              </button>
            ) : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        <section className="catalog-grid" aria-label="Books catalog grid">
          {paginatedBooks.map((book, idx) => (
            <article key={book.id} className="catalog-card">
              <div className="catalog-card-main">
                <div className="catalog-card-cover" aria-hidden="true">
                  <img
                    src={getBookCoverArtwork(book)}
                    alt=""
                    width={124}
                    height={163}
                    loading={idx >= 4 ? 'lazy' : undefined}
                    decoding="async"
                    className="catalog-card-cover-img"
                  />
                </div>

                <div className="catalog-card-info">
                  <div className="catalog-card-top">
                    <span className="catalog-id-badge mono">{formatCallNumber(book.id)}</span>
                    <span
                      className={
                        book.available
                          ? 'catalog-status-badge catalog-status-available'
                          : 'catalog-status-badge catalog-status-borrowed'
                      }
                    >
                      <span className="catalog-status-dot" aria-hidden="true" />
                      {book.available ? 'Available' : 'Borrowed'}
                    </span>
                  </div>

                  <div className="catalog-card-heading">
                    <h3 className="catalog-card-title">{book.title}</h3>
                    <p className="catalog-card-author">{book.author}</p>
                  </div>

                  <div className="catalog-card-meta">
                    <span className="catalog-meta-item">
                      <Calendar size={14} className="catalog-meta-icon" aria-hidden="true" />
                      <span className="tabular-nums">{book.publicationYear}</span>
                    </span>
                    <span className="catalog-meta-sep" aria-hidden="true" />
                    <span className="catalog-meta-item">
                      <Layers size={14} className="catalog-meta-icon" aria-hidden="true" />
                      <span className="mono">Record #{book.id}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="catalog-card-actions">
                <button
                  type="button"
                  className="catalog-inspect-btn"
                  aria-label={`Inspect ${book.title}`}
                  onClick={() => onInspectBook(book.id)}
                >
                  <Eye size={15} aria-hidden="true" />
                  <span>Inspect</span>
                </button>

                <div className="catalog-card-actions-right">
                  {isStaff ? (
                    <div className="row-actions">
                      {book.available ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          aria-label={`Borrow ${book.title}`}
                          onClick={() => onBorrowBook(book)}
                        >
                          <Repeat size={14} aria-hidden="true" />
                          <span>Borrow</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon icon-square-btn"
                        onClick={() => onEditBook(book)}
                        aria-label={`Edit ${book.title}`}
                        title="Edit book"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft-danger btn-icon icon-square-btn"
                        onClick={() => onDeleteBook(book)}
                        aria-label={`Delete ${book.title}`}
                        title="Delete book"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="catalog-details-btn"
                    aria-label={`Details: ${book.title}`}
                    onClick={() => onInspectBook(book.id)}
                  >
                    <span>Details</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="card" aria-label="Books catalog list table">
          <div className="card-header">
            <div>
              <h3 className="card-title">Catalog Table</h3>
              <p className="card-subtitle">Tabular view of matching catalog records</p>
            </div>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={tableCaptionId}
            className="table-wrapper"
          >
            <table
              className="data-table"
              style={{
                ['--label-2' as string]: '"Author"',
                ['--label-3' as string]: '"Year"',
                ['--label-4' as string]: '"Status"',
                ['--label-5' as string]: '"Actions"',
              }}
            >
              <caption id={tableCaptionId}>Library book inventory</caption>
              <thead>
                <tr>
                  <th scope="col">Title &amp; Call No.</th>
                  <th scope="col">Author</th>
                  <th scope="col">Year</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBooks.map((book) => (
                  <tr key={book.id}>
                    <th scope="row">
                      <div>{book.title}</div>
                      <div className="mono table-subline">
                        {formatCallNumber(book.id)} · Record #{book.id}
                      </div>
                    </th>
                    <td>{book.author}</td>
                    <td className="tabular-nums">{book.publicationYear}</td>
                    <td>
                      <span
                        className={
                          book.available
                            ? 'catalog-status-badge catalog-status-available'
                            : 'catalog-status-badge catalog-status-borrowed'
                        }
                      >
                        <span className="catalog-status-dot" aria-hidden="true" />
                        {book.available ? 'Available' : 'Borrowed'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onInspectBook(book.id)}
                        >
                          <Eye size={14} aria-hidden="true" />
                          <span>Inspect</span>
                        </button>
                        {isStaff && book.available ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => onBorrowBook(book)}
                          >
                            Borrow
                          </button>
                        ) : null}
                        {isStaff ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => onEditBook(book)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-soft-danger btn-sm"
                              onClick={() => onDeleteBook(book)}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Client-side Result Count & Pagination */}
      {filteredBooks.length > 0 ? (
        <footer className="catalog-pagination" aria-label="Catalog results summary">
          <p className="catalog-pagination-count">
            Showing <strong className="tabular-nums">{rangeStart}–{rangeEnd}</strong> of{' '}
            <strong className="tabular-nums">{filteredBooks.length}</strong> book
            {filteredBooks.length === 1 ? '' : 's'}
          </p>

          <nav className="catalog-pagination-nav" aria-label="Catalog pages">
            <button
              type="button"
              className="catalog-page-btn catalog-page-nav"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(safePage - 1)}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              <span>Previous</span>
            </button>

            <div className="catalog-page-numbers">
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  className="catalog-page-btn catalog-page-num tabular-nums"
                  aria-current={page === safePage ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="catalog-page-btn catalog-page-nav"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
            >
              <span>Next</span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </footer>
      ) : null}
    </div>
  );
}
