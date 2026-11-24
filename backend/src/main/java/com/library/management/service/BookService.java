
package com.library.management.service;

import com.library.management.dto.BookRequest;
import com.library.management.exception.BookNotFoundException;
import com.library.management.model.Book;
import com.library.management.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BookService {

    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    // Get all the book
    @Transactional(readOnly = true)
    public List<Book> getAllBooks(String search) {
        if (search == null || search.isBlank()) {
            return bookRepository.findAll();
        }

        String keyword = search.strip();

        return bookRepository
            .findByTitleContainingIgnoreCaseOrAuthorContainingIgnoreCase(
                keyword, keyword
            );
    }

    // get Book by ID
    @Transactional(readOnly = true)
    public Book getBookById(Long id) {
        return bookRepository.findById(id)
            .orElseThrow(() -> new BookNotFoundException(id));
    }

    // Create Book
    @Transactional
    public Book createBook(BookRequest request) {
        Book book = new Book(
            request.title(),
            request.author(),
            request.publicationYear()
        );

        return bookRepository.save(book);
    }

    // Update Book
    @Transactional
    public Book updateBook(Long id, BookRequest request) {
        Book book = getBookById(id);

        book.updateDetails(
            request.title(),
            request.author(),
            request.publicationYear()
        );

        return bookRepository.save(book);
    }

    // Delete Book
    @Transactional
    public void deleteBook(Long id) {
        Book book = getBookById(id);
        bookRepository.delete(book);
    }
}
