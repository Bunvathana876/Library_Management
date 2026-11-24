package com.library.management.controller;

import com.library.management.dto.BookRequest;
import com.library.management.exception.BookNotFoundException;
import com.library.management.exception.GlobalExceptionHandler;
import com.library.management.model.Book;
import com.library.management.service.BookService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class BookControllerTest {

    @Mock
    private BookService bookService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .standaloneSetup(new BookController(bookService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    void shouldCreateBookWhenRequestIsValid() throws Exception {
        Book created = new Book("Clean Code", "Robert C. Martin", 2008);
        when(bookService.createBook(any(BookRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "title": "Clean Code",
                        "author": "Robert C. Martin",
                        "publicationYear": 2008
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Clean Code"))
            .andExpect(jsonPath("$.author").value("Robert C. Martin"))
            .andExpect(jsonPath("$.publicationYear").value(2008))
            .andExpect(jsonPath("$.available").value(true));

        verify(bookService).createBook(eq(new BookRequest("Clean Code", "Robert C. Martin", 2008)));
    }

    @Test
    void shouldReturnBadRequestWhenCreateBookRequestIsInvalid() throws Exception {
        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "title": "   ",
                        "author": "",
                        "publicationYear": -5
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("Request validation failed"))
            .andExpect(jsonPath("$.errors.title").value("Title is required"))
            .andExpect(jsonPath("$.errors.author").value("Author is required"))
            .andExpect(jsonPath("$.errors.publicationYear").value("Publication year must be positive"));

        verify(bookService, never()).createBook(any());
    }

    @Test
    void shouldUpdateBookAndBindPathVariableId() throws Exception {
        Book updated = new Book("Refactoring", "Martin Fowler", 2018);
        when(bookService.updateBook(eq(42L), any(BookRequest.class))).thenReturn(updated);

        mockMvc.perform(put("/api/books/42")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "title": "Refactoring",
                        "author": "Martin Fowler",
                        "publicationYear": 2018
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Refactoring"))
            .andExpect(jsonPath("$.author").value("Martin Fowler"))
            .andExpect(jsonPath("$.publicationYear").value(2018));

        verify(bookService).updateBook(eq(42L), any(BookRequest.class));
    }

    @Test
    void shouldReturnBadRequestWhenUpdateBookRequestIsInvalid() throws Exception {
        mockMvc.perform(put("/api/books/42")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "title": "",
                        "author": "",
                        "publicationYear": 0
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("Request validation failed"));

        verify(bookService, never()).updateBook(any(), any());
    }

    @Test
    void shouldReturnNotFoundWhenBookIsMissing() throws Exception {
        when(bookService.getBookById(999L)).thenThrow(new BookNotFoundException(999L));

        mockMvc.perform(get("/api/books/999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail").value("Book with ID 999 not found"));

        verify(bookService).getBookById(999L);
    }

    @Test
    void shouldDeleteBook() throws Exception {
        mockMvc.perform(delete("/api/books/42"))
            .andExpect(status().isNoContent());

        verify(bookService).deleteBook(42L);
    }
}
