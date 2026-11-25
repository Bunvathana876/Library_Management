package com.library.management.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity 
@Table(name = "members")
public class Member {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 30)
    private String phone;

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Transient
    private int activeLoanCount;

    @Transient
    private int overdueLoanCount;

    @Transient
    private BigDecimal unpaidFinesTotal = BigDecimal.ZERO;

    @Transient
    private boolean borrowingBlocked;

    @Transient
    private String borrowingBlockReason;

    protected Member() {
        // Required by JPA
    }

    public Member(String fullName, String email) {
        this(fullName, email, null, null);
    }

    public Member(String fullName, String email, String phone, String notes) {
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.notes = notes;
        this.active = true;
        this.createdAt = Instant.now();
    }

    public void updateProfile(String fullName, String email, String phone, String notes) {
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.notes = notes;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public void applyStanding(
            int activeLoanCount,
            int overdueLoanCount,
            BigDecimal unpaidFinesTotal,
            boolean borrowingBlocked,
            String borrowingBlockReason
    ) {
        this.activeLoanCount = Math.max(0, activeLoanCount);
        this.overdueLoanCount = Math.max(0, overdueLoanCount);
        this.unpaidFinesTotal = unpaidFinesTotal != null ? unpaidFinesTotal : BigDecimal.ZERO;
        this.borrowingBlocked = borrowingBlocked;
        this.borrowingBlockReason = borrowingBlockReason;
    }

    public Long getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public boolean isActive() {
        return active;
    }

    public String getPhone() {
        return phone;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public int getActiveLoanCount() {
        return activeLoanCount;
    }

    public int getOverdueLoanCount() {
        return overdueLoanCount;
    }

    public BigDecimal getUnpaidFinesTotal() {
        return unpaidFinesTotal;
    }

    public boolean isBorrowingBlocked() {
        return borrowingBlocked;
    }

    public String getBorrowingBlockReason() {
        return borrowingBlockReason;
    }
}
