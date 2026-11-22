package com.library.management.dto;

public record CreateBookRequest (String title,
    String author,int publicationYear) {
    
}
