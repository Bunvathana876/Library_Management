package com.library.management.controller;

import com.library.management.dto.BookCopyRequest;
import com.library.management.dto.BookCopyResponse;
import com.library.management.dto.BookRequest;
import com.library.management.model.Book;
import com.library.management.service.BookService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController 
@RequestMapping ("/api/books")
public class BookController {
    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    // Get all books
    @GetMapping
    public List<Book> getAllBooks(
            @RequestParam (defaultValue = "") String search,
            @RequestParam (defaultValue = "") String category
    ) {
        return bookService.getAllBooks(search, category);
    }

    @GetMapping("/categories")
    public List<String> getCategories() {
        return bookService.getCategories();
    }

    // Get book by ID
    @GetMapping("/{id}")
    public Book getBookById(@PathVariable Long id) {
        return bookService.getBookById(id);
    }

    @GetMapping("/{id}/copies")
    public List<BookCopyResponse> getCopies(@PathVariable Long id) {
        return bookService.getCopiesForBook(id);
    }

    @PostMapping("/{id}/copies")
    @ResponseStatus(HttpStatus.CREATED)
    public BookCopyResponse addCopy(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) BookCopyRequest request
    ) {
        return bookService.addCopy(id, request);
    }

    @PatchMapping("/{id}/copies/{copyId}")
    public BookCopyResponse updateCopy(
            @PathVariable Long id,
            @PathVariable Long copyId,
            @Valid @RequestBody BookCopyRequest request
    ) {
        return bookService.updateCopy(id, copyId, request);
    }

    @DeleteMapping("/{id}/copies/{copyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCopy(
            @PathVariable Long id,
            @PathVariable Long copyId
    ) {
        bookService.deleteCopy(id, copyId);
    }

    // Create a new book
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Book createBook(
            @Valid @RequestBody BookRequest request
    ) {
        return bookService.createBook(request);
    }

    // Update a book
    @PutMapping("/{id}")
    public Book updateBook(@PathVariable Long id, @Valid @RequestBody BookRequest request) {
        return bookService.updateBook(id, request);
    }

    // Delete a book
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBook(@PathVariable Long id) {
        bookService.deleteBook(id);
    }
}
