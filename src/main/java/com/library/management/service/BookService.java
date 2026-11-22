
package com.library.management.service;

import com.library.management.dto.BookRequest;
import com.library.management.exception.BookNotFoundException;
import com.library.management.model.Book;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;

@Service
public class BookService {

    private final Map<Long ,Book> books = new LinkedHashMap<>();
    private long nextId = 3L;

    public BookService() {
        books.put(1L, new Book(
            1L, "Clean Code",
            "Robert C. Martin", 2008, true
        ));

        books.put(2L, new Book(
            2L, "Effective Java",
            "Joshua Bloch", 2018, true
        ));
    }

    // Read All And Search
    public synchronized List<Book> getAllBooks(String search) {
        String keyword = search.strip().toLowerCase(Locale.ROOT);
        return books.values().stream()
                .filter(book -> book.getTitle().toLowerCase(Locale.ROOT).contains(keyword)
                        || book.getAuthor().toLowerCase(Locale.ROOT).contains(keyword))
                .toList();
    }

    // Read by ID
    public synchronized Book getBookById(Long id) {
        Book book = books.get(id);
        if (book == null){
            throw new BookNotFoundException(id);
        }
        return book;
    }

    // Create
    public synchronized Book createBook(BookRequest request) {
        
        Book book = new Book(
            nextId++,
            request.title(),
            request.author(),
            request.publicationYear(),
            true
        );

        books.put(book.getId(),book);

        return book;
    }

    // Update
    public synchronized Book updateBook(Long id,BookRequest request) {
        
        Book existingBook = books.get(id);

        Book updatedBook = new Book(id, request.title(), request.author(), request.publicationYear(), existingBook.isAvailable());

        books.put(id, updatedBook);

        return updatedBook;
    }

    // Delete
    public synchronized void deleteBook(Long id) {

        if (books.remove(id) == null) {
            throw new BookNotFoundException(id);
        }
    }
}
