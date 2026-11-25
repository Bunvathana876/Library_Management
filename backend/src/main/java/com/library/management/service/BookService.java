package com.library.management.service;

import com.library.management.dto.BookCopyRequest;
import com.library.management.dto.BookCopyResponse;
import com.library.management.dto.BookRequest;
import com.library.management.exception.BookNotFoundException;
import com.library.management.exception.BusinessRuleException;
import com.library.management.exception.ResourceNotFoundException;
import com.library.management.model.Book;
import com.library.management.model.BookCopy;
import com.library.management.model.BookCopyStatus;
import com.library.management.model.HoldStatus;
import com.library.management.repository.BookCopyRepository;
import com.library.management.repository.BookRepository;
import com.library.management.repository.HoldRepository;
import com.library.management.util.IsbnUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class BookService {

    private static final List<HoldStatus> ACTIVE_HOLD_STATUSES =
        List.of(HoldStatus.WAITING, HoldStatus.READY_FOR_PICKUP);

    private final BookRepository bookRepository;
    private final HoldRepository holdRepository;
    private final BookCopyRepository bookCopyRepository;

    public BookService(BookRepository bookRepository) {
        this(bookRepository, null, null);
    }

    public BookService(BookRepository bookRepository, HoldRepository holdRepository) {
        this(bookRepository, holdRepository, null);
    }

    @Autowired
    public BookService(
            BookRepository bookRepository,
            HoldRepository holdRepository,
            BookCopyRepository bookCopyRepository
    ) {
        this.bookRepository = bookRepository;
        this.holdRepository = holdRepository;
        this.bookCopyRepository = bookCopyRepository;
    }

    @Transactional(readOnly = true)
    public List<Book> getAllBooks(String search) {
        return getAllBooks(search, "");
    }

    @Transactional(readOnly = true)
    public List<Book> getAllBooks(String search, String category) {
        List<Book> books;
        if (search == null || search.isBlank()) {
            books = bookRepository.findAll();
        } else {
            String keyword = search.strip();
            String normalizedKeyword = keyword.replaceAll("[\\s-]+", "");
            if (normalizedKeyword.isEmpty()) {
                normalizedKeyword = keyword;
            }
            books = bookRepository.searchBooks(keyword, normalizedKeyword);
        }

        if (category != null && !category.isBlank()) {
            String targetCategory = category.strip().toLowerCase(Locale.ROOT);
            books = books.stream()
                .filter(b -> b.getCategory() != null && b.getCategory().strip().toLowerCase(Locale.ROOT).equals(targetCategory))
                .toList();
        }

        return enrichBookSummaries(books);
    }

    @Transactional(readOnly = true)
    public List<String> getCategories() {
        return bookRepository.findDistinctCategories();
    }

    @Transactional(readOnly = true)
    public Book getBookById(Long id) {
        Book book = bookRepository.findById(id)
            .orElseThrow(() -> new BookNotFoundException(id));
        enrichBookSummaries(List.of(book));
        return book;
    }

    @Transactional
    public Book createBook(BookRequest request) {
        String title = request.title().strip();
        String author = request.author().strip();
        String isbn = normalizeOptionalIsbn(request.isbn());
        String publisher = normalizeOptionalText(request.publisher());
        String coverUrl = normalizeOptionalCoverUrl(request.coverUrl());
        String category = normalizeOptionalText(request.category());
        String shelfLocation = normalizeOptionalText(request.shelfLocation());

        Book book = new Book(
            title,
            author,
            request.publicationYear(),
            isbn,
            publisher,
            coverUrl,
            category,
            shelfLocation
        );

        Book saved = bookRepository.save(book);

        if (bookCopyRepository != null && saved.getId() != null) {
            int count = request.initialCopies() != null ? request.initialCopies() : 1;
            int clampedCount = Math.max(1, Math.min(50, count));
            for (int i = 1; i <= clampedCount; i++) {
                String barcode = generateUniqueBarcode(saved.getId(), i);
                bookCopyRepository.save(new BookCopy(
                    saved,
                    barcode,
                    BookCopyStatus.AVAILABLE,
                    shelfLocation,
                    null
                ));
            }
            enrichBookSummaries(List.of(saved));
        } else {
            saved.applyCopySummary(1, 1, 0, 0);
        }

        return saved;
    }

    @Transactional
    public Book updateBook(Long id, BookRequest request) {
        Book book = bookRepository.findById(id)
            .orElseThrow(() -> new BookNotFoundException(id));

        String title = request.title().strip();
        String author = request.author().strip();
        String isbn = normalizeOptionalIsbn(request.isbn());
        String publisher = normalizeOptionalText(request.publisher());
        String coverUrl = normalizeOptionalCoverUrl(request.coverUrl());
        String category = normalizeOptionalText(request.category());
        String shelfLocation = normalizeOptionalText(request.shelfLocation());

        book.updateDetails(
            title,
            author,
            request.publicationYear(),
            isbn,
            publisher,
            coverUrl,
            category,
            shelfLocation
        );

        Book saved = bookRepository.save(book);
        enrichBookSummaries(List.of(saved));
        return saved;
    }

    @Transactional
    public void deleteBook(Long id) {
        Book book = bookRepository.findById(id)
            .orElseThrow(() -> new BookNotFoundException(id));
        bookRepository.delete(book);
    }

    @Transactional(readOnly = true)
    public List<BookCopyResponse> getCopiesForBook(Long bookId) {
        if (!bookRepository.existsById(bookId)) {
            throw new BookNotFoundException(bookId);
        }
        return bookCopyRepository.findAllByBookIdOrderByIdAsc(bookId)
            .stream()
            .map(BookCopyResponse::from)
            .toList();
    }

    @Transactional
    public BookCopyResponse addCopy(Long bookId, BookCopyRequest request) {
        Book book = bookRepository.findByIdForUpdate(bookId)
            .orElseThrow(() -> new BookNotFoundException(bookId));

        String requestedBarcode = request != null ? normalizeOptionalText(request.barcode()) : null;
        String barcode;
        if (requestedBarcode != null) {
            barcode = requestedBarcode.toUpperCase(Locale.ROOT);
            if (bookCopyRepository.existsByBarcodeIgnoreCase(barcode)) {
                throw new BusinessRuleException("A copy with barcode " + barcode + " already exists");
            }
        } else {
            long existingCount = bookCopyRepository.findAllByBookIdOrderByIdAsc(bookId).size();
            barcode = generateUniqueBarcode(bookId, (int) existingCount + 1);
        }

        BookCopyStatus initialStatus = request != null && request.status() != null
            ? request.status()
            : BookCopyStatus.AVAILABLE;
        if (initialStatus == BookCopyStatus.LOANED || initialStatus == BookCopyStatus.ON_HOLD) {
            throw new BusinessRuleException("New copies cannot start as LOANED or ON_HOLD");
        }

        String shelfLocation = request != null && normalizeOptionalText(request.shelfLocation()) != null
            ? normalizeOptionalText(request.shelfLocation())
            : book.getShelfLocation();
        String conditionNotes = request != null ? normalizeOptionalText(request.conditionNotes()) : null;

        BookCopy saved = bookCopyRepository.save(
            new BookCopy(book, barcode, initialStatus, shelfLocation, conditionNotes)
        );
        syncBookAvailability(book);
        return BookCopyResponse.from(saved);
    }

    @Transactional
    public BookCopyResponse updateCopy(Long bookId, Long copyId, BookCopyRequest request) {
        Book book = bookRepository.findByIdForUpdate(bookId)
            .orElseThrow(() -> new BookNotFoundException(bookId));

        BookCopy copy = bookCopyRepository.findByIdForUpdate(copyId)
            .orElseThrow(() -> new ResourceNotFoundException("Book copy", copyId));

        if (!copy.getBook().getId().equals(bookId)) {
            throw new ResourceNotFoundException("Book copy", copyId);
        }

        BookCopyStatus nextStatus = request != null ? request.status() : null;
        if (nextStatus != null && nextStatus != copy.getStatus()) {
            if (copy.getStatus() == BookCopyStatus.LOANED || copy.getStatus() == BookCopyStatus.ON_HOLD) {
                throw new BusinessRuleException(
                    "Cannot manually change status while copy is " + copy.getStatus().name()
                );
            }
            if (nextStatus == BookCopyStatus.LOANED || nextStatus == BookCopyStatus.ON_HOLD) {
                throw new BusinessRuleException(
                    "Use checkout or hold workflows to mark a copy as " + nextStatus.name()
                );
            }
        }

        String shelfLocation = request != null ? normalizeOptionalText(request.shelfLocation()) : copy.getShelfLocation();
        String conditionNotes = request != null ? normalizeOptionalText(request.conditionNotes()) : copy.getConditionNotes();
        copy.updateMetadata(nextStatus, shelfLocation, conditionNotes);

        BookCopy saved = bookCopyRepository.save(copy);
        syncBookAvailability(book);
        return BookCopyResponse.from(saved);
    }

    @Transactional
    public void deleteCopy(Long bookId, Long copyId) {
        Book book = bookRepository.findByIdForUpdate(bookId)
            .orElseThrow(() -> new BookNotFoundException(bookId));

        BookCopy copy = bookCopyRepository.findByIdForUpdate(copyId)
            .orElseThrow(() -> new ResourceNotFoundException("Book copy", copyId));

        if (!copy.getBook().getId().equals(bookId)) {
            throw new ResourceNotFoundException("Book copy", copyId);
        }

        if (copy.getStatus() == BookCopyStatus.LOANED || copy.getStatus() == BookCopyStatus.ON_HOLD) {
            throw new BusinessRuleException("Cannot delete a copy that is currently loaned or held for pickup");
        }

        List<BookCopy> allCopies = bookCopyRepository.findAllByBookIdOrderByIdAsc(bookId);
        if (allCopies.size() <= 1) {
            throw new BusinessRuleException("Cannot remove the last physical copy; delete the book title instead");
        }

        bookCopyRepository.delete(copy);
        syncBookAvailability(book);
    }

    @Transactional
    public void syncBookAvailability(Book book) {
        if (bookCopyRepository == null || book == null || book.getId() == null) {
            return;
        }
        long availableCount = bookCopyRepository.countByBookIdAndStatus(book.getId(), BookCopyStatus.AVAILABLE);
        book.setAvailable(availableCount > 0);
        bookRepository.save(book);
    }

    private String generateUniqueBarcode(Long bookId, int startingSeq) {
        int seq = Math.max(1, startingSeq);
        while (seq < 10_000) {
            String candidate = String.format("CPY-%04d-%02d", bookId, seq);
            if (!bookCopyRepository.existsByBarcodeIgnoreCase(candidate)) {
                return candidate;
            }
            seq++;
        }
        return String.format("CPY-%04d-%d", bookId, System.currentTimeMillis());
    }

    private String normalizeOptionalIsbn(String rawIsbn) {
        if (rawIsbn == null || rawIsbn.isBlank()) {
            return null;
        }
        String normalized = IsbnUtils.normalize(rawIsbn);
        if (!IsbnUtils.isValid(normalized)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "ISBN must be a valid ISBN-10 or ISBN-13"
            );
        }
        return normalized;
    }

    private String normalizeOptionalText(String rawText) {
        if (rawText == null) {
            return null;
        }
        String stripped = rawText.strip();
        return stripped.isEmpty() ? null : stripped;
    }

    private String normalizeOptionalCoverUrl(String rawCoverUrl) {
        if (rawCoverUrl == null || rawCoverUrl.isBlank()) {
            return null;
        }
        String sanitized = IsbnUtils.sanitizeCoverUrl(rawCoverUrl);
        if (sanitized == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Cover URL must be a valid http(s) or relative URL"
            );
        }
        return sanitized;
    }

    private List<Book> enrichBookSummaries(List<Book> books) {
        if (books.isEmpty()) {
            return books;
        }
        List<Long> bookIds = books.stream()
            .map(Book::getId)
            .filter(Objects::nonNull)
            .toList();
        if (bookIds.isEmpty()) {
            return books;
        }

        if (holdRepository != null) {
            Map<Long, Integer> countsByBookId = new HashMap<>();
            for (Object[] row : holdRepository.countActiveHoldsByBookIds(bookIds, ACTIVE_HOLD_STATUSES)) {
                if (row != null && row.length >= 2 && row[0] instanceof Long bookId && row[1] instanceof Number count) {
                    countsByBookId.put(bookId, count.intValue());
                }
            }
            Set<Long> readyBookIds = holdRepository.findBookIdsByStatus(HoldStatus.READY_FOR_PICKUP);
            for (Book book : books) {
                if (book.getId() != null) {
                    int count = countsByBookId.getOrDefault(book.getId(), 0);
                    boolean ready = readyBookIds.contains(book.getId());
                    book.applyHoldSummary(count, ready);
                }
            }
        }

        if (bookCopyRepository != null) {
            Map<Long, int[]> copyStats = new HashMap<>();
            for (Object[] row : bookCopyRepository.countCopiesByBookIdsAndStatus(bookIds)) {
                if (row != null && row.length >= 3 && row[0] instanceof Long bookId
                        && row[1] instanceof BookCopyStatus status && row[2] instanceof Number count) {
                    int[] arr = copyStats.computeIfAbsent(bookId, k -> new int[4]);
                    int n = count.intValue();
                    arr[0] += n; // total
                    if (status == BookCopyStatus.AVAILABLE) {
                        arr[1] += n;
                    } else if (status == BookCopyStatus.LOANED) {
                        arr[2] += n;
                    } else if (status == BookCopyStatus.ON_HOLD) {
                        arr[3] += n;
                    }
                }
            }
            for (Book book : books) {
                if (book.getId() != null) {
                    int[] arr = copyStats.get(book.getId());
                    if (arr != null) {
                        book.applyCopySummary(arr[0], arr[1], arr[2], arr[3]);
                    } else {
                        int fallbackAvail = book.isAvailable() ? 1 : 0;
                        book.applyCopySummary(1, fallbackAvail, book.isAvailable() ? 0 : 1, 0);
                    }
                }
            }
        } else {
            for (Book book : books) {
                int fallbackAvail = book.isAvailable() ? 1 : 0;
                book.applyCopySummary(1, fallbackAvail, book.isAvailable() ? 0 : 1, 0);
            }
        }

        return books;
    }
}
