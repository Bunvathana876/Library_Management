package com.library.management.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MemberDetailResponse(
    Long id,
    String fullName,
    String email,
    boolean active,
    String phone,
    String notes,
    Instant createdAt,
    int activeLoanCount,
    int overdueLoanCount,
    int activeLoanLimit,
    BigDecimal unpaidFinesTotal,
    BigDecimal fineBlockThreshold,
    boolean borrowingBlocked,
    String borrowingBlockReason,
    List<LoanResponse> activeLoans,
    List<LoanResponse> returnHistory,
    List<LoanResponse> fineLoans,
    List<HoldResponse> activeHolds,
    List<HoldResponse> pastHolds
) {}
