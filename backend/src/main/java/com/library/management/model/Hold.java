package com.library.management.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "holds")
public class Hold {

    public static final int PICKUP_WINDOW_DAYS = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "copy_id")
    private BookCopy copy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private HoldStatus status;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @Column(name = "ready_at")
    private Instant readyAt;

    @Column(name = "expires_on")
    private LocalDate expiresOn;

    @Column(name = "fulfilled_at")
    private Instant fulfilledAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected Hold() {
        // Required by JPA
    }

    public Hold(Book book, Member member, Instant placedAt) {
        this.book = book;
        this.member = member;
        this.status = HoldStatus.WAITING;
        this.placedAt = placedAt != null ? placedAt : Instant.now();
    }

    public void markReadyForPickup(Instant now, LocalDate expiresOn) {
        this.status = HoldStatus.READY_FOR_PICKUP;
        this.readyAt = now != null ? now : Instant.now();
        this.expiresOn = expiresOn;
    }

    public void markFulfilled(Instant now) {
        this.status = HoldStatus.FULFILLED;
        this.fulfilledAt = now != null ? now : Instant.now();
    }

    public void markCancelled(Instant now) {
        this.status = HoldStatus.CANCELLED;
        this.cancelledAt = now != null ? now : Instant.now();
    }

    public void markExpired() {
        this.status = HoldStatus.EXPIRED;
    }

    public boolean isActive() {
        return this.status == HoldStatus.WAITING || this.status == HoldStatus.READY_FOR_PICKUP;
    }

    public Long getId() {
        return id;
    }

    public Book getBook() {
        return book;
    }

    public BookCopy getCopy() {
        return copy;
    }

    public void setCopy(BookCopy copy) {
        this.copy = copy;
    }

    public Member getMember() {
        return member;
    }

    public HoldStatus getStatus() {
        return status;
    }

    public Instant getPlacedAt() {
        return placedAt;
    }

    public Instant getReadyAt() {
        return readyAt;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public Instant getFulfilledAt() {
        return fulfilledAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }
}
