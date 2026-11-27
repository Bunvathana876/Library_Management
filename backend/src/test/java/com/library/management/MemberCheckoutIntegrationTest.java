package com.library.management;

import com.library.management.model.AppUser;
import com.library.management.model.UserRole;
import com.library.management.repository.AppUserRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;
import com.library.management.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.containsString;

@SpringBootTest
@AutoConfigureMockMvc
class MemberCheckoutIntegrationTest extends PostgresIntegrationTest {
    private static final String PASSWORD = "Member-test-password-123!";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AppUserRepository users;
    @Autowired MemberRepository members;
    @Autowired LoanRepository loans;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    private String staffToken;

    record Reader(String email, String token, long memberId) {}

    @BeforeEach
    void staffAccount() {
        String email = UUID.randomUUID() + "@checkout.test";
        users.save(new AppUser(email, "unused-test-hash", UserRole.LIBRARIAN));
        staffToken = jwt.createToken(new UsernamePasswordAuthenticationToken(email, null,
            List.of(new SimpleGrantedAuthority("ROLE_LIBRARIAN"))));
    }

    ResultActions postJson(String path, Object body, String token) throws Exception {
        var request = post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mvc.perform(request);
    }

    JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    Reader register() throws Exception {
        String email = UUID.randomUUID() + "@checkout.test";
        postJson("/api/auth/register", Map.of("fullName", "Checkout Reader", "email", email, "password", PASSWORD), null)
            .andExpect(status().isCreated());
        var login = postJson("/api/auth/login", Map.of("email", email, "password", PASSWORD), null)
            .andExpect(status().isOk());
        return new Reader(email, body(login).get("accessToken").asString(), members.findByEmailIgnoreCase(email).orElseThrow().getId());
    }

    long book(int copies) throws Exception {
        return body(postJson("/api/books", Map.of("title", "Reader checkout " + UUID.randomUUID(),
            "author", "QA", "publicationYear", 2026, "initialCopies", copies), staffToken)
            .andExpect(status().isCreated())).get("id").asLong();
    }

    ResultActions borrow(Reader reader, long bookId) throws Exception {
        return postJson("/api/me/loans", Map.of("bookId", bookId), reader.token());
    }

    @Test
    void registeredReaderSignsInBorrowsAndSeesOwnLoan() throws Exception {
        Reader reader = register();
        long bookId = book(1);
        JsonNode loan = body(borrow(reader, bookId).andExpect(status().isCreated())
            .andExpect(jsonPath("$.memberId").value(reader.memberId()))
            .andExpect(jsonPath("$.copyBarcode").isNotEmpty()));
        assertEquals(LocalDate.parse(loan.get("borrowedOn").asString()).plusDays(14), LocalDate.parse(loan.get("dueOn").asString()));
        mvc.perform(get("/api/me/bookshelf").header("Authorization", "Bearer " + reader.token()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.activeLoans[0].id").value(loan.get("id").asLong()));
        mvc.perform(get("/api/books/" + bookId)).andExpect(jsonPath("$.available").value(false));
        assertEquals(1, loans.countByMemberIdAndReturnedOnIsNull(reader.memberId()));
    }

    @Test
    void selfCheckoutRequiresAuthenticationAndCannotSelectAnotherBorrower() throws Exception {
        Reader reader = register();
        Reader other = register();
        long bookId = book(1);
        postJson("/api/me/loans", Map.of("bookId", bookId), null).andExpect(status().isUnauthorized());
        postJson("/api/loans", Map.of("bookId", bookId, "memberId", other.memberId()), reader.token())
            .andExpect(status().isForbidden());
        postJson("/api/me/loans", Map.of("bookId", bookId, "memberId", other.memberId()), reader.token())
            .andExpect(status().isCreated()).andExpect(jsonPath("$.memberId").value(reader.memberId()));
        assertEquals(0, loans.countByMemberIdAndReturnedOnIsNull(other.memberId()));
    }

    @Test
    void invalidDuplicateAndUnavailableRequestsLeaveInventoryConsistent() throws Exception {
        Reader first = register();
        Reader second = register();
        postJson("/api/me/loans", Map.of(), first.token()).andExpect(status().isBadRequest());
        borrow(first, -1).andExpect(status().isBadRequest());
        borrow(first, Long.MAX_VALUE).andExpect(status().isNotFound());
        long bookId = book(1);
        borrow(first, bookId).andExpect(status().isCreated());
        borrow(first, bookId).andExpect(status().isConflict()).andExpect(jsonPath("$.detail", containsString("already has an active loan")));
        borrow(second, bookId).andExpect(status().isConflict());
        assertEquals(1, loans.countByMemberIdAndReturnedOnIsNull(first.memberId()));
        assertEquals(0, loans.countByMemberIdAndReturnedOnIsNull(second.memberId()));
    }

    @Test
    void sixthSelfCheckoutIsRejectedWithoutConsumingItsCopy() throws Exception {
        Reader reader = register();
        for (int i = 0; i < 5; i++) borrow(reader, book(1)).andExpect(status().isCreated());
        long sixth = book(1);
        borrow(reader, sixth).andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail", containsString("Borrowing limit reached (5/5")));
        assertEquals(5, loans.countByMemberIdAndReturnedOnIsNull(reader.memberId()));
        mvc.perform(get("/api/books/" + sixth)).andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void inactiveAndFineBlockedMembersCannotSelfCheckout() throws Exception {
        Reader inactive = register();
        var member = members.findById(inactive.memberId()).orElseThrow();
        member.setActive(false);
        members.save(member);
        long available = book(1);
        borrow(inactive, available).andExpect(status().isConflict()).andExpect(jsonPath("$.detail", containsString("deactivated")));
        Reader overdue = register();
        long loanId = body(borrow(overdue, book(1)).andExpect(status().isCreated())).get("id").asLong();
        jdbc.update("update loans set borrowed_on = ?, due_on = ? where id = ?",
            LocalDate.now().minusDays(50), LocalDate.now().minusDays(30), loanId);
        borrow(overdue, available).andExpect(status().isConflict()).andExpect(jsonPath("$.detail", containsString("unpaid fines")));
        mvc.perform(get("/api/books/" + available)).andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void reservedCopyCanOnlyBeBorrowedByItsHoldOwner() throws Exception {
        Reader borrower = register();
        Reader waiting = register();
        Reader outsider = register();
        long bookId = book(1);
        long loanId = body(borrow(borrower, bookId).andExpect(status().isCreated())).get("id").asLong();
        postJson("/api/holds", Map.of("bookId", bookId), waiting.token()).andExpect(status().isCreated());
        postJson("/api/loans/" + loanId + "/return", Map.of(), staffToken).andExpect(status().isOk());
        borrow(outsider, bookId).andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value("This book is currently reserved for another member at the circulation desk"));
        borrow(waiting, bookId).andExpect(status().isCreated()).andExpect(jsonPath("$.memberId").value(waiting.memberId()));
        assertEquals(0, loans.countByMemberIdAndReturnedOnIsNull(outsider.memberId()));
        assertEquals(1, loans.countByMemberIdAndReturnedOnIsNull(waiting.memberId()));
    }
}
