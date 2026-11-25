
package com.library.management.controller;

import com.library.management.dto.BorrowRequest;
import com.library.management.dto.FineActionRequest;
import com.library.management.dto.LoanResponse;
import com.library.management.service.LoanService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/loans")
public class LoanController {

    private final LoanService loanService;

    public LoanController(LoanService loanService) {
        this.loanService = loanService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoanResponse borrow(
            @Valid @RequestBody BorrowRequest request
    ) {
        return loanService.borrow(request);
    }

    @GetMapping("/active")
    public List<LoanResponse> getActiveLoans() {
        return loanService.getActiveLoans();
    }

    @GetMapping("/overdue")
    public List<LoanResponse> getOverdueLoans() {
        return loanService.getOverdueLoans();
    }

    @GetMapping("/fines")
    public List<LoanResponse> getFineLoans() {
        return loanService.getFineLoans();
    }

    @GetMapping("/{id}")
    public LoanResponse getLoan(@PathVariable Long id) {
        return loanService.getLoan(id);
    }

    @PostMapping("/{id}/return")
    public LoanResponse returnBook(@PathVariable Long id) {
        return loanService.returnBook(id);
    }

    @PostMapping("/{id}/renew")
    public LoanResponse renewLoan(@PathVariable Long id) {
        return loanService.renewLoan(id);
    }

    @PostMapping("/{id}/fine/pay")
    public LoanResponse payFine(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) FineActionRequest request
    ) {
        return loanService.payFine(id, request != null ? request.note() : null);
    }

    @PostMapping("/{id}/fine/waive")
    public LoanResponse waiveFine(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) FineActionRequest request
    ) {
        return loanService.waiveFine(id, request != null ? request.note() : null);
    }
}
