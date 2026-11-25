package com.library.management.dto;

import java.util.List;

public record MemberBookshelfResponse(
    Long memberId,
    String fullName,
    String email,
    List<LoanResponse> activeLoans,
    List<LoanResponse> returnHistory,
    List<HoldResponse> activeHolds,
    List<HoldResponse> pastHolds
) {}
