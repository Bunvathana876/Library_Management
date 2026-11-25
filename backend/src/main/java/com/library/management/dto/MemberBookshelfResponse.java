package com.library.management.dto;

import java.math.BigDecimal;
import java.util.List;

public record MemberBookshelfResponse(
    Long memberId,
    String fullName,
    String email,
    boolean active,
    int activeLoanLimit,
    BigDecimal dailyFineRate,
    BigDecimal unpaidFinesTotal,
    BigDecimal fineBlockThreshold,
    boolean borrowingBlocked,
    String borrowingBlockReason,
    List<LoanResponse> activeLoans,
    List<LoanResponse> returnHistory,
    List<LoanResponse> fineLoans,
    List<HoldResponse> activeHolds,
    List<HoldResponse> pastHolds
) {
    public MemberBookshelfResponse(
            Long memberId,
            String fullName,
            String email,
            List<LoanResponse> activeLoans,
            List<LoanResponse> returnHistory,
            List<HoldResponse> activeHolds,
            List<HoldResponse> pastHolds
    ) {
        this(
            memberId,
            fullName,
            email,
            true,
            5,
            new BigDecimal("0.50"),
            BigDecimal.ZERO,
            new BigDecimal("10.00"),
            false,
            null,
            activeLoans,
            returnHistory,
            List.of(),
            activeHolds,
            pastHolds
        );
    }
}
