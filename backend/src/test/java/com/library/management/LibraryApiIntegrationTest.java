
package com.library.management;

import com.library.management.repository.BookRepository;
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

import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
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
}
