package com.library.management.controller;

import com.library.management.dto.BookMetadataResponse;
import com.library.management.exception.GlobalExceptionHandler;
import com.library.management.exception.ResourceNotFoundException;
import com.library.management.service.IsbnLookupService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class IsbnLookupControllerTest {

    @Mock
    private IsbnLookupService isbnLookupService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new IsbnLookupController(isbnLookupService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldReturnBookMetadataWhenFound() throws Exception {
        BookMetadataResponse response = new BookMetadataResponse(
                "9780132350884",
                "Clean Code",
                "Robert C. Martin",
                2008,
                "Prentice Hall",
                "https://covers.openlibrary.org/b/id/15126503-L.jpg",
                "Open Library"
        );
        when(isbnLookupService.lookupByIsbn("978-0-13-235088-4")).thenReturn(response);

        mockMvc.perform(get("/api/books/isbn/978-0-13-235088-4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isbn").value("9780132350884"))
                .andExpect(jsonPath("$.title").value("Clean Code"))
                .andExpect(jsonPath("$.author").value("Robert C. Martin"))
                .andExpect(jsonPath("$.publicationYear").value(2008))
                .andExpect(jsonPath("$.publisher").value("Prentice Hall"))
                .andExpect(jsonPath("$.coverUrl").value("https://covers.openlibrary.org/b/id/15126503-L.jpg"))
                .andExpect(jsonPath("$.source").value("Open Library"));
    }

    @Test
    void shouldReturnBadRequestForInvalidIsbn() throws Exception {
        when(isbnLookupService.lookupByIsbn("12345"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a valid 10- or 13-digit ISBN."));

        mockMvc.perform(get("/api/books/isbn/12345"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Please enter a valid 10- or 13-digit ISBN."));
    }

    @Test
    void shouldReturnNotFoundWhenIsbnHasNoMetadata() throws Exception {
        when(isbnLookupService.lookupByIsbn("9789999999998"))
                .thenThrow(new ResourceNotFoundException("No book metadata found for ISBN 9789999999998"));

        mockMvc.perform(get("/api/books/isbn/9789999999998"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No book metadata found for ISBN 9789999999998"));
    }

    @Test
    void shouldReturnBadGatewayWhenUpstreamIsUnavailable() throws Exception {
        when(isbnLookupService.lookupByIsbn("9780132350884"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to reach Open Library right now."));

        mockMvc.perform(get("/api/books/isbn/9780132350884"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.detail").value("Unable to reach Open Library right now."));
    }
}
