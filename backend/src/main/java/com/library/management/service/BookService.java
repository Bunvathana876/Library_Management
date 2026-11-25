
package com.library.management.service;

import com.library.management.dto.BookRequest;
import com.library.management.exception.BookNotFoundException;
import com.library.management.model.Book;
import com.library.management.model.HoldStatus;
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
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class BookService {

    private static final List<HoldStatus> ACTIVE_HOLD_STATUSES =
        List.of(HoldStatus.WAITING, HoldStatus.READY_FOR_PICKUP);

    private final BookRepository bookRepository;
    private final HoldRepository holdRepository;

    public BookService(BookRepository bookRepository) {
        this(bookRepository, null);
    }

    @Autowired
    public BookService(BookRepository bookRepository, HoldRepository holdRepository) {
        this.bookRepository = bookRepository;
        this.holdRepository = holdRepository;
    }

    // Get all the book
    @Transactional(readOnly = true)
    public List<Book> getAllBooks(String search) {
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
        return enrichHoldSummaries(books);
    }

    // get Book by ID
    @Transactional(readOnly = true)
    public Book getBookById(Long id) {
        Book book = bookRepository.findById(id)
            .orElseThrow(() -> new BookNotFoundException(id));
        enrichHoldSummaries(List.of(book));
        return book;
    }

    // Create Book
    @Transactional
    public Book createBook(BookRequest request) {
        String title = request.title().strip();
        String author = request.author().strip();
        String isbn = normalizeOptionalIsbn(request.isbn());
        String publisher = normalizeOptionalText(request.publisher());
        String coverUrl = normalizeOptionalCoverUrl(request.coverUrl());

        Book book = new Book(
            title,
            author,
            request.publicationYear(),
            isbn,
            publisher,
            coverUrl
        );

        return bookRepository.save(book);
    }

    // Update Book
    @Transactional
    public Book updateBook(Long id, BookRequest request) {
        Book book = getBookById(id);

        String title = request.title().strip();
        String author = request.author().strip();
        String isbn = normalizeOptionalIsbn(request.isbn());
        String publisher = normalizeOptionalText(request.publisher());
        String coverUrl = normalizeOptionalCoverUrl(request.coverUrl());

        book.updateDetails(
            title,
            author,
            request.publicationYear(),
            isbn,
            publisher,
            coverUrl
        );

        return bookRepository.save(book);
    }

    // Delete Book
    @Transactional
    public void deleteBook(Long id) {
        Book book = getBookById(id);
        bookRepository.delete(book);
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

    private List<Book> enrichHoldSummaries(List<Book> books) {
        if (holdRepository == null || books.isEmpty()) {
            return books;
        }
        List<Long> bookIds = books.stream()
            .map(Book::getId)
            .filter(Objects::nonNull)
            .toList();
        if (bookIds.isEmpty()) {
            return books;
        }
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
        return books;
    }
}
