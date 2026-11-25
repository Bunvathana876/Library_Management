package com.library.management.controller;

import com.library.management.dto.BookMetadataResponse;
import com.library.management.service.IsbnLookupService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books/isbn")
public class IsbnLookupController {

    private final IsbnLookupService isbnLookupService;

    public IsbnLookupController(IsbnLookupService isbnLookupService) {
        this.isbnLookupService = isbnLookupService;
    }

    @GetMapping("/{isbn}")
    public BookMetadataResponse lookupByIsbn(@PathVariable String isbn) {
        return isbnLookupService.lookupByIsbn(isbn);
    }
}
