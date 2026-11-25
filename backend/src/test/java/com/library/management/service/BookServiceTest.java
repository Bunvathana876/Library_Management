
package com.library.management.service;

import com.library.management.dto.BookRequest;
import com.library.management.model.Book;
import com.library.management.repository.BookRepository;
import com.library.management.exception.BookNotFoundException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookServiceTest {

    @Mock
    private BookRepository bookRepository;

    @InjectMocks
    private BookService bookService;

    @Test
    void shouldFindBookById() {
        Book book = new Book(
            "Clean Code", "Robert C. Martin", 2008
        );

        when(bookRepository.findById(1L))
            .thenReturn(Optional.of(book));

        Book result = bookService.getBookById(1L);

        assertEquals("Clean Code", result.getTitle());
        verify(bookRepository).findById(1L);
    }

    @Test
    void shouldThrowWhenBookMissing() {
        when(bookRepository.findById(999L))
            .thenReturn(Optional.empty());

        assertThrows(
            BookNotFoundException.class,
            () -> bookService.getBookById(999L)
        );
    }

    @Test
    void shouldCreateBook() {
        BookRequest request = new BookRequest(
            "Spring Boot", "John Smith", 2025
        );

        when(bookRepository.save(any(Book.class)))
            .thenAnswer(call -> call.getArgument(0));

        Book result = bookService.createBook(request);

        assertEquals("Spring Boot", result.getTitle());
        verify(bookRepository).save(any(Book.class));
    }

    @Test
    void shouldNormalizeIsbnAndUpgradeCoverUrlWhenCreatingBook() {
        BookRequest request = new BookRequest(
            " Clean Code ",
            " Robert C. Martin ",
            2008,
            "978-0-13-235088-4",
            " Prentice Hall ",
            "http://covers.openlibrary.org/b/id/15126503-L.jpg"
        );

        when(bookRepository.save(any(Book.class)))
            .thenAnswer(call -> call.getArgument(0));

        Book result = bookService.createBook(request);

        assertEquals("Clean Code", result.getTitle());
        assertEquals("Robert C. Martin", result.getAuthor());
        assertEquals("9780132350884", result.getIsbn());
        assertEquals("Prentice Hall", result.getPublisher());
        assertEquals("https://covers.openlibrary.org/b/id/15126503-L.jpg", result.getCoverUrl());
    }

    @Test
    void shouldRejectInvalidIsbnChecksum() {
        BookRequest request = new BookRequest(
            "Clean Code",
            "Robert C. Martin",
            2008,
            "9780132350885",
            null,
            null
        );

        assertThrows(ResponseStatusException.class, () -> bookService.createBook(request));
        verify(bookRepository, never()).save(any());
    }

    @Test
    void shouldSearchBooksWithNormalizedIsbnKeyword() {
        Book cleanCode = new Book("Clean Code", "Robert C. Martin", 2008, "9780132350884", "Prentice Hall", null);
        when(bookRepository.searchBooks("978-0-13-235088-4", "9780132350884"))
            .thenReturn(List.of(cleanCode));

        List<Book> results = bookService.getAllBooks(" 978-0-13-235088-4 ");

        assertEquals(1, results.size());
        verify(bookRepository).searchBooks("978-0-13-235088-4", "9780132350884");
    }
}
