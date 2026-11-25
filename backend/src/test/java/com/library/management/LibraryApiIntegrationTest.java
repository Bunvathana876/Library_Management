
package com.library.management;

import com.library.management.repository.BookRepository;
import com.library.management.repository.HoldRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;
import com.library.management.service.JwtService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@ActiveProfiles("test")
class LibraryApiIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres =
        new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void testProperties(DynamicPropertyRegistry registry) {

        // Fixed key is for isolated tests ONLY.
        String testSecret = Base64.getEncoder().encodeToString(
            "0123456789abcdef0123456789abcdef"
                .getBytes(StandardCharsets.UTF_8)
        );

        registry.add(
            "app.jwt.secret-base64",
            () -> testSecret
        );

        registry.add(
            "spring.datasource.password",
            () -> "test-only-password"
        );
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    JwtService jwtService;

    @Autowired
    BookRepository bookRepository;

    @Autowired
    MemberRepository memberRepository;

    @Autowired
    LoanRepository loanRepository;

    @Autowired
    HoldRepository holdRepository;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void publicCanViewBooks() throws Exception {

        mvc.perform(get("/api/books"))
            .andExpect(status().isOk());
    }

    @Test
    void anonymousCannotCreateBook() throws Exception {

        mvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Spring Testing",
                      "author": "Example Author",
                      "publicationYear": 2026
                    }
                    """))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void adminCanCreateBookInPostgres() throws Exception {

        var authentication =
            new UsernamePasswordAuthenticationToken(
                "admin@test.local",
                null,
                List.of(
                    new SimpleGrantedAuthority("ROLE_ADMIN")
                )
            );

        String token = jwtService.createToken(authentication);

        mvc.perform(post("/api/books")
                .header(
                    HttpHeaders.AUTHORIZATION,
                    "Bearer " + token
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Spring Integration Testing",
                      "author": "Example Author",
                      "publicationYear": 2026
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(
                jsonPath("$.title")
                    .value("Spring Integration Testing")
            );

        boolean exists = bookRepository.findAll()
            .stream()
            .anyMatch(book ->
                book.getTitle().equals(
                    "Spring Integration Testing"
                )
            );

        assertTrue(exists);
    }

    @Test
    void adminCanPersistAndSearchBookWithIsbnPublisherAndCover() throws Exception {
        var adminAuth = new UsernamePasswordAuthenticationToken(
                "admin@test.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
        String adminToken = jwtService.createToken(adminAuth);

        mvc.perform(post("/api/books")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Designing Data-Intensive Applications",
                      "author": "Martin Kleppmann",
                      "publicationYear": 2017,
                      "isbn": "978-1-4493-7332-0",
                      "publisher": "O'Reilly Media",
                      "coverUrl": "https://covers.openlibrary.org/b/id/8434671-L.jpg"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.isbn").value("9781449373320"))
            .andExpect(jsonPath("$.publisher").value("O'Reilly Media"))
            .andExpect(jsonPath("$.coverUrl").value("https://covers.openlibrary.org/b/id/8434671-L.jpg"));

        mvc.perform(get("/api/books").param("search", "978-1-4493-7332-0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].isbn").value("9781449373320"))
            .andExpect(jsonPath("$[0].publisher").value("O'Reilly Media"));
    }

    @Test
    void isbnLookupEndpointRequiresStaffRoleAndValidatesIsbn() throws Exception {
        mvc.perform(get("/api/books/isbn/9780132350884"))
            .andExpect(status().isUnauthorized());

        var memberAuth = new UsernamePasswordAuthenticationToken(
                "member@test.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))
        );
        String memberToken = jwtService.createToken(memberAuth);

        mvc.perform(get("/api/books/isbn/9780132350884")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + memberToken))
            .andExpect(status().isForbidden());

        var librarianAuth = new UsernamePasswordAuthenticationToken(
                "librarian@test.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_LIBRARIAN"))
        );
        String librarianToken = jwtService.createToken(librarianAuth);

        mvc.perform(get("/api/books/isbn/invalid-isbn")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + librarianToken))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("Please enter a valid 10- or 13-digit ISBN."));
    }

    @Test
    void memberBookshelfRenewalsAndHoldQueueWorkflow() throws Exception {
        String librarianToken = jwtService.createToken(new UsernamePasswordAuthenticationToken(
                "librarian@test.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_LIBRARIAN"))
        ));
        String aliceToken = jwtService.createToken(new UsernamePasswordAuthenticationToken(
                "alice.patron@test.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))
        ));
        String bobToken = jwtService.createToken(new UsernamePasswordAuthenticationToken(
                "bob.patron@test.local",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))
        ));

        // 1. Staff creates book and registers Alice via bookshelf auto-provision
        MvcResult bookRes = mvc.perform(post("/api/books")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + librarianToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "title": "Holds Queue Handbook",
                      "author": "Patron Author",
                      "publicationYear": 2024
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        long bookId = objectMapper.readTree(bookRes.getResponse().getContentAsString()).get("id").asLong();

        // Alice checks her empty bookshelf (auto-creates member profile)
        MvcResult aliceShelfRes = mvc.perform(get("/api/me/bookshelf")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + aliceToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("alice.patron@test.local"))
            .andReturn();
        long aliceMemberId = objectMapper.readTree(aliceShelfRes.getResponse().getContentAsString()).get("memberId").asLong();

        // 2. Staff borrows book for Alice
        MvcResult loanRes = mvc.perform(post("/api/loans")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + librarianToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bookId\":" + bookId + ",\"memberId\":" + aliceMemberId + "}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.renewalCount").value(0))
            .andExpect(jsonPath("$.renewable").value(true))
            .andReturn();
        long loanId = objectMapper.readTree(loanRes.getResponse().getContentAsString()).get("id").asLong();

        // 3. Alice renews once via self-service (+14 days)
        mvc.perform(post("/api/me/loans/" + loanId + "/renew")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + aliceToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.renewalCount").value(1))
            .andExpect(jsonPath("$.renewable").value(true));

        // 4. Bob places a hold on the loaned-out book
        MvcResult bobHoldRes = mvc.perform(post("/api/holds")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bobToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bookId\":" + bookId + "}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("WAITING"))
            .andExpect(jsonPath("$.queuePosition").value(1))
            .andReturn();
        long bobHoldId = objectMapper.readTree(bobHoldRes.getResponse().getContentAsString()).get("id").asLong();

        // 5. Alice's 2nd renewal is now blocked by Bob's hold (409 Conflict)
        mvc.perform(post("/api/me/loans/" + loanId + "/renew")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + aliceToken))
            .andExpect(status().isConflict());

        // Member cannot access staff holds desk or fulfill endpoint
        mvc.perform(get("/api/holds/active")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bobToken))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/holds/" + bobHoldId + "/fulfill")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bobToken))
            .andExpect(status().isForbidden());

        // 6. Staff returns Alice's loan -> automatically promotes Bob's hold to READY_FOR_PICKUP
        mvc.perform(post("/api/loans/" + loanId + "/return")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + librarianToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.heldForMemberName").isNotEmpty());

        mvc.perform(get("/api/books/" + bookId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(false))
            .andExpect(jsonPath("$.reservedForPickup").value(true))
            .andExpect(jsonPath("$.activeHoldCount").value(1));

        // 7. Staff fulfills Bob's ready hold
        MvcResult fulfilledLoanRes = mvc.perform(post("/api/holds/" + bobHoldId + "/fulfill")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + librarianToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bookId").value(bookId))
            .andReturn();
        JsonNode fulfilledLoanJson = objectMapper.readTree(fulfilledLoanRes.getResponse().getContentAsString());
        assertEquals(0, fulfilledLoanJson.get("renewalCount").asInt());

        // Bob can view his active loan in My Bookshelf, Alice sees it in returnHistory
        mvc.perform(get("/api/me/bookshelf")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bobToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.activeLoans.length()").value(1));
        mvc.perform(get("/api/me/bookshelf")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + aliceToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.returnHistory.length()").value(1));
    }
}
