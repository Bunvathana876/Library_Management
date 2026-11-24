
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
}
