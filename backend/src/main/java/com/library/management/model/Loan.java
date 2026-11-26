package com.library.management.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "copy_id")
    private BookCopy copy;

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

    @Column(name = "fine_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal fineAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "fine_status", nullable = false, length = 20)
    private FineStatus fineStatus = FineStatus.NONE;

    @Column(name = "fine_settled_at")
    private Instant fineSettledAt;

    @Column(name = "fine_note", length = 255)
    private String fineNote;

    protected Loan() {
        // Required by JPA
    }

    public Loan(
            Book book,
            Member member,
            LocalDate borrowedOn,
            LocalDate dueOn
    ) {
        this(book, null, member, borrowedOn, dueOn);
    }

    public Loan(
            Book book,
            BookCopy copy,
            Member member,
            LocalDate borrowedOn,
            LocalDate dueOn
    ) {
        this.book = book;
        this.copy = copy;
        this.member = member;
        this.borrowedOn = borrowedOn;
        this.dueOn = dueOn;
        this.renewalCount = 0;
        this.fineAmount = BigDecimal.ZERO;
        this.fineStatus = FineStatus.NONE;
    }

    public void markReturned(LocalDate date) {
        this.returnedOn = date;
    }

    public void assessFine(BigDecimal amount) {
        if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            this.fineAmount = amount;
            this.fineStatus = FineStatus.UNPAID;
            this.fineSettledAt = null;
        } else {
            this.fineAmount = BigDecimal.ZERO;
            this.fineStatus = FineStatus.NONE;
        }
    }

    public void markFinePaid(Instant now, String note) {
        this.fineStatus = FineStatus.PAID;
        this.fineSettledAt = now != null ? now : Instant.now();
        if (note != null && !note.isBlank()) {
            this.fineNote = note.trim();
        }
    }

    public void markFineWaived(Instant now, String note) {
        this.fineStatus = FineStatus.WAIVED;
        this.fineSettledAt = now != null ? now : Instant.now();
        if (note != null && !note.isBlank()) {
            this.fineNote = note.trim();
        }
    }

    public String renewalDisabledReason(LocalDate today, boolean hasActiveHold, boolean fineBlocked) {
        if (returnedOn != null) return "Already returned";
        if (dueOn.isBefore(today)) return "Overdue loans cannot be renewed";
        if (!member.isActive()) return "Deactivated member accounts cannot renew loans";
        if (fineBlocked) return "Blocked by unpaid overdue fines";
        if (renewalCount >= MAX_RENEWALS) return "Maximum 2 renewals reached";
        if (hasActiveHold) return "Blocked by an active hold";
        return null;
    }

    public void renew(LocalDate today) {
        java.util.Objects.requireNonNull(today, "Renewal date is required");
        String reason = renewalDisabledReason(today, false, false);
        if (reason != null) {
            throw new com.library.management.exception.BusinessRuleException(reason);
        }
        this.dueOn = this.dueOn.plusDays(RENEWAL_EXTENSION_DAYS);
        this.renewalCount += 1;
        this.lastRenewedOn = today;
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

    public BigDecimal getFineAmount() {
        return fineAmount;
    }

    public FineStatus getFineStatus() {
        return fineStatus;
    }

    public Instant getFineSettledAt() {
        return fineSettledAt;
    }

    public String getFineNote() {
        return fineNote;
    }
}
