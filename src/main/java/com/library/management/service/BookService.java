
package com.library.management.service;

import com.library.management.dto.CreateBookRequest;
import com.library.management.model.Book;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
public class BookService {

    private final List<Book> books = new ArrayList<>();
    private long nextId = 3L;

    public BookService() {
        books.add(new Book(
            1L, "Clean Code",
            "Robert C. Martin", 2008, true
        ));

        books.add(new Book(
            2L, "Effective Java",
            "Joshua Bloch", 2018, true
        ));
    }

    public List<Book> getAllBooks() {
        return List.copyOf(books);
    }

    public Book getBookById(Long id) {

        for (Book book : books) {
            if (book.getId().equals(id)) {
                return book;
            }
        }

        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Book not found"
        );
    }

    public Book createBook(CreateBookRequest request) {

        if (request.title() == null
                || request.title().isBlank()
                || request.author() == null
                || request.author().isBlank()
                || request.publicationYear() <= 0) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Valid book details are required"
            );
        }

        Book book = new Book(
            nextId++,
            request.title(),
            request.author(),
            request.publicationYear(),
            true
        );

        books.add(book);

        return book;
    }
}
