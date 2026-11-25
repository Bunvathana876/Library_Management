package com.library.management.dto;

import com.library.management.model.FineStatus;
import com.library.management.model.Loan;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record LoanResponse(
    Long id,
    Long bookId,
    Long copyId,
    String copyBarcode,
    String bookTitle,
    String bookAuthor,
    String bookIsbn,
    String bookCoverUrl,
    Long memberId,
    String memberName,
    LocalDate borrowedOn,
    LocalDate dueOn,
    LocalDate returnedOn,
    boolean overdue,
    int overdueDays,
    BigDecimal fineAmount,
    FineStatus fineStatus,
    Instant fineSettledAt,
    String fineNote,
    int renewalCount,
    int maxRenewals,
    LocalDate lastRenewedOn,
    boolean hasActiveHold,
    boolean renewable,
    String renewDisabledReason,
    String heldForMemberName
) {
    private static final BigDecimal DEFAULT_DAILY_FINE_RATE = new BigDecimal("0.50");

    public static LoanResponse from(Loan loan) {
        return from(loan, false, null, DEFAULT_DAILY_FINE_RATE, false);
    }

    public static LoanResponse from(Loan loan, boolean hasActiveHold) {
        return from(loan, hasActiveHold, null, DEFAULT_DAILY_FINE_RATE, false);
    }

    public static LoanResponse from(Loan loan, boolean hasActiveHold, String heldForMemberName) {
        return from(loan, hasActiveHold, heldForMemberName, DEFAULT_DAILY_FINE_RATE, false);
    }

    public static LoanResponse from(
            Loan loan,
            boolean hasActiveHold,
            String heldForMemberName,
            BigDecimal dailyFineRate,
            boolean memberFineBlocked
    ) {
        LocalDate today = LocalDate.now();
        BigDecimal effectiveRate = dailyFineRate != null ? dailyFineRate : DEFAULT_DAILY_FINE_RATE;

        boolean overdue =
            loan.getReturnedOn() == null
            && loan.getDueOn().isBefore(today);

        int overdueDays = 0;
        BigDecimal fineAmount;
        FineStatus fineStatus;

        if (loan.getReturnedOn() == null) {
            if (loan.getDueOn().isBefore(today)) {
                overdueDays = (int) Math.max(0, ChronoUnit.DAYS.between(loan.getDueOn(), today));
                fineAmount = effectiveRate
                    .multiply(BigDecimal.valueOf(overdueDays))
                    .setScale(2, RoundingMode.HALF_UP);
                fineStatus = fineAmount.compareTo(BigDecimal.ZERO) > 0 ? FineStatus.UNPAID : FineStatus.NONE;
            } else {
                fineAmount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
                fineStatus = FineStatus.NONE;
            }
        } else {
            if (loan.getDueOn().isBefore(loan.getReturnedOn())) {
                overdueDays = (int) Math.max(0, ChronoUnit.DAYS.between(loan.getDueOn(), loan.getReturnedOn()));
            }
            fineAmount = (loan.getFineAmount() != null ? loan.getFineAmount() : BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
            fineStatus = loan.getFineStatus() != null ? loan.getFineStatus() : FineStatus.NONE;
        }

        int renewalCount = loan.getRenewalCount();
        int maxRenewals = Loan.MAX_RENEWALS;
        boolean renewable = loan.getReturnedOn() == null
            && renewalCount < maxRenewals
            && !hasActiveHold
            && !memberFineBlocked;

        String disabledReason = null;
        if (loan.getReturnedOn() != null) {
            disabledReason = "Already returned";
        } else if (hasActiveHold) {
            disabledReason = "Blocked by an active hold";
        } else if (memberFineBlocked) {
            disabledReason = "Blocked by unpaid overdue fines";
        } else if (renewalCount >= maxRenewals) {
            disabledReason = "Maximum 2 renewals reached";
        }

        Long copyId = loan.getCopy() != null ? loan.getCopy().getId() : null;
        String copyBarcode = loan.getCopy() != null ? loan.getCopy().getBarcode() : null;

        return new LoanResponse(
            loan.getId(),
            loan.getBook().getId(),
            copyId,
            copyBarcode,
            loan.getBook().getTitle(),
            loan.getBook().getAuthor(),
            loan.getBook().getIsbn(),
            loan.getBook().getCoverUrl(),
            loan.getMember().getId(),
            loan.getMember().getFullName(),
            loan.getBorrowedOn(),
            loan.getDueOn(),
            loan.getReturnedOn(),
            overdue,
            overdueDays,
            fineAmount,
            fineStatus,
            loan.getFineSettledAt(),
            loan.getFineNote(),
            renewalCount,
            maxRenewals,
            loan.getLastRenewedOn(),
            hasActiveHold,
            renewable,
            disabledReason,
            heldForMemberName
        );
    }
}
