
package com.library.management.service;

import com.library.management.dto.BookRequest;
import com.library.management.model.Book;
import com.library.management.exception.BookNotFoundException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BookServiceTest {

    private BookService bookService;

    @BeforeEach
    void setUp() {
        bookService = new BookService();
    }

    @Test
    void shouldGetAllBooks() {
        assertEquals(
            2, bookService.getAllBooks("").size()
        );
    }

    @Test
    void shouldFindBookById() {
        Book book = bookService.getBookById(1L);

        assertEquals("Clean Code", book.getTitle());
    }

    @Test
    void shouldCreateBook() {
        BookRequest request = new BookRequest(
            "Spring Boot", "John Smith", 2024
        );

        Book book = bookService.createBook(request);

        assertEquals("Spring Boot", book.getTitle());
        assertTrue(book.isAvailable());
        assertEquals(
            3, bookService.getAllBooks("").size()
        );
    }

    @Test
    void shouldUpdateBook() {
        BookRequest request = new BookRequest(
            "New Title", "New Author", 2025
        );

        Book book = bookService.updateBook(1L, request);

        assertEquals(1L, book.getId());
        assertEquals("New Title", book.getTitle());
        assertEquals(
            "New Title",
            bookService.getBookById(1L).getTitle()
        );
    }

    @Test
    void shouldDeleteBook() {
        bookService.deleteBook(1L);

        assertThrows(
            BookNotFoundException.class,
            () -> bookService.getBookById(1L)
        );
    }

    @Test
    void shouldThrowExceptionForMissingBook() {
        assertThrows(
            BookNotFoundException.class,
            () -> bookService.getBookById(999L)
        );
    }

    @Test
    void shouldSearchBooks() {
        assertEquals(
            1, bookService.getAllBooks("JAVA").size()
        );
    }
}
