package com.library.management.model;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "book_copies")
public class BookCopy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @Column(nullable = false, unique = true, length = 64)
    private String barcode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookCopyStatus status;

    @Column(name = "shelf_location", length = 60)
    private String shelfLocation;

    @Column(name = "condition_notes", length = 255)
    private String conditionNotes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected BookCopy() {
        // Required by JPA
    }

    public BookCopy(Book book, String barcode, BookCopyStatus status, String shelfLocation, String conditionNotes) {
        this.book = book;
        this.barcode = barcode;
        this.status = status != null ? status : BookCopyStatus.AVAILABLE;
        this.shelfLocation = shelfLocation;
        this.conditionNotes = conditionNotes;
        this.createdAt = Instant.now();
    }

    public void updateMetadata(BookCopyStatus status, String shelfLocation, String conditionNotes) {
        if (status != null) {
            this.status = status;
        }
        this.shelfLocation = shelfLocation;
        this.conditionNotes = conditionNotes;
    }

    public void setStatus(BookCopyStatus status) {
        this.status = status;
    }

    public boolean isAvailable() {
        return this.status == BookCopyStatus.AVAILABLE;
    }

    public Long getId() {
        return id;
    }

    public Book getBook() {
        return book;
    }

    public String getBarcode() {
        return barcode;
    }

    public BookCopyStatus getStatus() {
        return status;
    }

    public String getShelfLocation() {
        return shelfLocation;
    }

    public String getConditionNotes() {
        return conditionNotes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
