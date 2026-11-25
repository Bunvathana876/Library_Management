package com.library.management.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "loans")

public class Loan {
    public static final int MAX_RENEWALS = 2;
    public static final int RENEWAL_EXTENSION_DAYS = 14;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "borrowed_on", nullable = false)
    private LocalDate borrowedOn;

    @Column(name = "due_on", nullable = false)
    private LocalDate dueOn;

    @Column(name = "returned_on")
    private LocalDate returnedOn;

    @Column(name = "renewal_count", nullable = false)
    private int renewalCount;

    @Column(name = "last_renewed_on")
    private LocalDate lastRenewedOn;

    protected Loan() {
        // Required by JPA
    }

    public Loan(
            Book book,
            Member member,
            LocalDate borrowedOn,
            LocalDate dueOn
    ) {
        this.book = book;
        this.member = member;
        this.borrowedOn = borrowedOn;
        this.dueOn = dueOn;
        this.renewalCount = 0;
    }

    public void markReturned(LocalDate date) {
        this.returnedOn = date;
    }

    public void renew(LocalDate today) {
        LocalDate reference = today != null ? today : LocalDate.now();
        LocalDate baseDate = (this.dueOn != null && this.dueOn.isAfter(reference)) ? this.dueOn : reference;
        this.dueOn = baseDate.plusDays(RENEWAL_EXTENSION_DAYS);
        this.renewalCount += 1;
        this.lastRenewedOn = reference;
    }

    public Long getId() {
        return id;
    }

    public Book getBook() {
        return book;
    }

    public Member getMember() {
        return member;
    }

    public LocalDate getBorrowedOn() {
        return borrowedOn;
    }

    public LocalDate getDueOn() {
        return dueOn;
    }

    public LocalDate getReturnedOn() {
        return returnedOn;
    }

    public int getRenewalCount() {
        return renewalCount;
    }

    public LocalDate getLastRenewedOn() {
        return lastRenewedOn;
    }
}
