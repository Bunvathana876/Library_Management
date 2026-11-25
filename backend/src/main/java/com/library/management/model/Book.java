
package com.library.management.model;

import jakarta.persistence.*;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 150)
    private String author;

    @Column(name = "publication_year", nullable = false)
    private Integer publicationYear;

    @Column(length = 20)
    private String isbn;

    @Column(length = 150)
    private String publisher;

    @Column(name = "cover_url", length = 500)
    private String coverUrl;

    @Column(length = 80)
    private String category;

    @Column(name = "shelf_location", length = 60)
    private String shelfLocation;

    @Column(nullable = false)
    private boolean available;

    @Transient
    private int activeHoldCount;

    @Transient
    private boolean reservedForPickup;

    @Transient
    private int totalCopies;

    @Transient
    private int availableCopies;

    @Transient
    private int loanedCopies;

    @Transient
    private int onHoldCopies;

    protected Book() {
        // Required by JPA
    }

    public Book(
            String title,
            String author,
            Integer publicationYear
    ) {
        this(title, author, publicationYear, null, null, null, null, null);
    }

    public Book(
            String title,
            String author,
            Integer publicationYear,
            String isbn,
            String publisher,
            String coverUrl
    ) {
        this(title, author, publicationYear, isbn, publisher, coverUrl, null, null);
    }

    public Book(
            String title,
            String author,
            Integer publicationYear,
            String isbn,
            String publisher,
            String coverUrl,
            String category,
            String shelfLocation
    ) {
        this.title = title;
        this.author = author;
        this.publicationYear = publicationYear;
        this.isbn = isbn;
        this.publisher = publisher;
        this.coverUrl = coverUrl;
        this.category = category;
        this.shelfLocation = shelfLocation;
        this.available = true;
    }

    public void updateDetails(
            String title,
            String author,
            Integer publicationYear
    ) {
        updateDetails(title, author, publicationYear, this.isbn, this.publisher, this.coverUrl, this.category, this.shelfLocation);
    }

    public void updateDetails(
            String title,
            String author,
            Integer publicationYear,
            String isbn,
            String publisher,
            String coverUrl
    ) {
        updateDetails(title, author, publicationYear, isbn, publisher, coverUrl, this.category, this.shelfLocation);
    }

    public void updateDetails(
            String title,
            String author,
            Integer publicationYear,
            String isbn,
            String publisher,
            String coverUrl,
            String category,
            String shelfLocation
    ) {
        this.title = title;
        this.author = author;
        this.publicationYear = publicationYear;
        this.isbn = isbn;
        this.publisher = publisher;
        this.coverUrl = coverUrl;
        this.category = category;
        this.shelfLocation = shelfLocation;
    }


    public void markBorrowed() {
        this.available = false;
    }

    public void markReturned() {
        this.available = true;
    }

    public void setAvailable(boolean available) {
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

    public Integer getPublicationYear() {
        return publicationYear;
    }

    public String getIsbn() {
        return isbn;
    }

    public String getPublisher() {
        return publisher;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public String getCategory() {
        return category;
    }

    public String getShelfLocation() {
        return shelfLocation;
    }

    public boolean isAvailable() {
        return available;
    }

    public void applyHoldSummary(int activeHoldCount, boolean reservedForPickup) {
        this.activeHoldCount = Math.max(0, activeHoldCount);
        this.reservedForPickup = reservedForPickup;
    }

    public void applyCopySummary(int totalCopies, int availableCopies, int loanedCopies, int onHoldCopies) {
        this.totalCopies = Math.max(0, totalCopies);
        this.availableCopies = Math.max(0, availableCopies);
        this.loanedCopies = Math.max(0, loanedCopies);
        this.onHoldCopies = Math.max(0, onHoldCopies);
    }

    public int getActiveHoldCount() {
        return activeHoldCount;
    }

    public boolean isReservedForPickup() {
        return reservedForPickup;
    }

    public int getTotalCopies() {
        return totalCopies;
    }

    public int getAvailableCopies() {
        return availableCopies;
    }

    public int getLoanedCopies() {
        return loanedCopies;
    }

    public int getOnHoldCopies() {
        return onHoldCopies;
    }
}
