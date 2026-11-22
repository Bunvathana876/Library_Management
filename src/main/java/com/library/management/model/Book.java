package com.library.management.model;

public class Book {
    private final Long id;
    private final String title;
    private final String author;
    private final int publicationYear;
    private final boolean available;

    public Book(Long id, String title, String author, int publicationYear, boolean available) {
        this.id = id;
        this.title = title;
        this.author = author;
        this.publicationYear = publicationYear;
        this.available = available;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public int getPublicationYear() {
        return publicationYear;
    }

    public boolean isAvailable() {
        return available;
    }
}
