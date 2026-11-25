package com.library.management.dto;

import com.library.management.model.Loan;
import java.time.LocalDate;

public record LoanResponse(
    Long id,
    Long bookId,
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
    int renewalCount,
    int maxRenewals,
    LocalDate lastRenewedOn,
    boolean hasActiveHold,
    boolean renewable,
    String renewDisabledReason,
    String heldForMemberName
) {
    public static LoanResponse from(Loan loan) {
        return from(loan, false, null);
    }

    public static LoanResponse from(Loan loan, boolean hasActiveHold) {
        return from(loan, hasActiveHold, null);
    }

    public static LoanResponse from(Loan loan, boolean hasActiveHold, String heldForMemberName) {
        boolean overdue =
            loan.getReturnedOn() == null
            && loan.getDueOn().isBefore(LocalDate.now());

        int renewalCount = loan.getRenewalCount();
        int maxRenewals = Loan.MAX_RENEWALS;
        boolean renewable = loan.getReturnedOn() == null
            && renewalCount < maxRenewals
            && !hasActiveHold;

        String disabledReason = null;
        if (loan.getReturnedOn() != null) {
            disabledReason = "Already returned";
        } else if (hasActiveHold) {
            disabledReason = "Blocked by an active hold";
        } else if (renewalCount >= maxRenewals) {
            disabledReason = "Maximum 2 renewals reached";
        }

        return new LoanResponse(
            loan.getId(),
            loan.getBook().getId(),
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
