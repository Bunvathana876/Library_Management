package com.library.management.dto;

import com.library.management.model.Loan;
import java.time.LocalDate;

public record LoanResponse(
    Long id,
    Long bookId,
    String bookTitle,
    Long memberId,
    String memberName,
    LocalDate borrowedOn,
    LocalDate dueOn,
    LocalDate returnedOn,
    boolean overdue
) {
     public static LoanResponse from(Loan loan) {

        boolean overdue =
            loan.getReturnedOn() == null
            && loan.getDueOn().isBefore(LocalDate.now());

        return new LoanResponse(
            loan.getId(),
            loan.getBook().getId(),
            loan.getBook().getTitle(),
            loan.getMember().getId(),
            loan.getMember().getFullName(),
            loan.getBorrowedOn(),
            loan.getDueOn(),
            loan.getReturnedOn(),
            overdue
        );
    }
}
