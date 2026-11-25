package com.library.management.service;

import com.library.management.dto.BookMetadataResponse;
import com.library.management.exception.ResourceNotFoundException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class IsbnLookupServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    private IsbnLookupService createService(HttpServer mockServer, boolean enableGoogle) {
        String base = "http://127.0.0.1:" + mockServer.getAddress().getPort();
        return new IsbnLookupService(
                objectMapper,
                base + "/ol",
                base + "/covers",
                enableGoogle ? base + "/gb" : "",
                "",
                2000,
                3000
        );
    }

    private static void writeResponse(
            com.sun.net.httpserver.HttpExchange exchange,
            int status,
            String contentType,
            String body
    ) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, exchange.getRequestMethod().equals("HEAD") ? -1 : bytes.length);
        if (!exchange.getRequestMethod().equals("HEAD")) {
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
        exchange.close();
    }

    @Test
    void returnsPrimaryOpenLibraryMetadataAndCachesRepeatRequests() throws Exception {
        AtomicInteger primaryCalls = new AtomicInteger();

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ol/api/books", exchange -> {
            primaryCalls.incrementAndGet();
            String json = """
                {
                  "ISBN:9780132350884": {
                    "title": "Clean Code",
                    "authors": [{"name": "Robert C. Martin"}],
                    "publishers": [{"name": "Prentice Hall"}],
                    "publish_date": "July 2008",
                    "identifiers": {"isbn_13": ["9780132350884"]},
                    "cover": {"large": "https://covers.openlibrary.org/b/id/15126503-L.jpg"}
                  }
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.start();

        IsbnLookupService service = createService(server, false);

        BookMetadataResponse first = service.lookupByIsbn("978-0-13-235088-4");
        BookMetadataResponse second = service.lookupByIsbn("9780132350884");

        assertEquals("9780132350884", first.isbn());
        assertEquals("Clean Code", first.title());
        assertEquals("Robert C. Martin", first.author());
        assertEquals(2008, first.publicationYear());
        assertEquals("Prentice Hall", first.publisher());
        assertEquals("https://covers.openlibrary.org/b/id/15126503-L.jpg", first.coverUrl());
        assertEquals("Open Library", first.source());
        assertEquals(first, second);
        assertEquals(1, primaryCalls.get());
    }

    @Test
    void enrichesPartialPrimaryWithSearchAndVerifiedCoverFallback() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();

        server.createContext("/ol/api/books", exchange -> {
            String json = """
                {
                  "ISBN:9781617297571": {
                    "title": "Spring in Action, Sixth Edition",
                    "authors": [{"name": "Craig Walls"}]
                  }
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.createContext("/ol/search.json", exchange -> {
            String json = """
                {
                  "numFound": 1,
                  "docs": [
                    {
                      "title": "Spring in Action, Sixth Edition",
                      "author_name": ["Craig Walls"],
                      "first_publish_year": 2022,
                      "publisher": ["Manning Publications Co. LLC"],
                      "isbn": ["9781638356486", "9781617297571"]
                    }
                  ]
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.createContext("/covers/b/isbn/9781617297571-L.jpg", exchange ->
                writeResponse(exchange, 404, "image/jpeg", ""));
        server.start();

        IsbnLookupService service = createService(server, false);
        BookMetadataResponse missingCoverResult = service.lookupByIsbn("9781617297571");

        assertEquals("9781617297571", missingCoverResult.isbn());
        assertEquals("Spring in Action, Sixth Edition", missingCoverResult.title());
        assertEquals("Craig Walls", missingCoverResult.author());
        assertEquals(2022, missingCoverResult.publicationYear());
        assertEquals("Manning Publications Co. LLC", missingCoverResult.publisher());
        assertNull(missingCoverResult.coverUrl());

        // Now verify a cover HEAD 302 succeeds on another ISBN
        server.createContext("/ol/api/books/unused", exchange -> writeResponse(exchange, 404, "application/json", "{}"));
        server.removeContext("/ol/api/books");
        server.removeContext("/ol/search.json");
        server.createContext("/ol/api/books", exchange -> {
            String json = """
                {
                  "ISBN:9781449373320": {
                    "title": "Designing Data-Intensive Applications",
                    "authors": [{"name": "Martin Kleppmann"}],
                    "publishers": [{"name": "O'Reilly Media"}],
                    "publish_date": "2017"
                  }
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.createContext("/covers/b/isbn/9781449373320-L.jpg", exchange -> {
            exchange.getResponseHeaders().set("Location", baseUrl + "/archive/cover.jpg");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });

        BookMetadataResponse verifiedCoverResult = service.lookupByIsbn("9781449373320");
        assertTrue(verifiedCoverResult.coverUrl().endsWith("/covers/b/isbn/9781449373320-L.jpg?default=false"));
    }

    @Test
    void fallsBackToEditionAndAuthorEndpointWhenPrimaryAndSearchMiss() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ol/api/books", exchange -> writeResponse(exchange, 200, "application/json", "{}"));
        server.createContext("/ol/search.json", exchange -> writeResponse(exchange, 200, "application/json", "{\"docs\":[]}"));
        server.createContext("/ol/isbn/0134685997.json", exchange -> {
            String json = """
                {
                  "title": "Effective Java",
                  "publishers": ["Addison-Wesley Professional"],
                  "publish_date": "December 27, 2017",
                  "isbn_13": ["9780134685991"],
                  "covers": [-1, 8739161],
                  "authors": [{"key": "/authors/OL1607920A"}]
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.createContext("/ol/authors/OL1607920A.json", exchange -> {
            String json = """
                {
                  "name": "Joshua Bloch"
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.start();

        IsbnLookupService service = createService(server, false);
        BookMetadataResponse response = service.lookupByIsbn("0134685997");

        assertEquals("9780134685991", response.isbn());
        assertEquals("Effective Java", response.title());
        assertEquals("Joshua Bloch", response.author());
        assertEquals(2017, response.publicationYear());
        assertEquals("Addison-Wesley Professional", response.publisher());
        assertTrue(response.coverUrl().endsWith("/covers/b/id/8739161-L.jpg?default=false"));
    }

    @Test
    void fallsBackToGoogleBooksWhenOpenLibraryHasNoMatchAndIgnoresGoogleRateLimit() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ol/api/books", exchange -> writeResponse(exchange, 200, "application/json", "{}"));
        server.createContext("/ol/search.json", exchange -> writeResponse(exchange, 200, "application/json", "{\"docs\":[]}"));
        server.createContext("/ol/isbn/9780132350884.json", exchange -> writeResponse(exchange, 404, "application/json", "{}"));
        server.createContext("/gb/volumes", exchange -> {
            String json = """
                {
                  "items": [
                    {
                      "volumeInfo": {
                        "title": "Clean Code",
                        "authors": ["Robert C. Martin"],
                        "publisher": "Pearson",
                        "publishedDate": "2008-08-01",
                        "imageLinks": {
                          "thumbnail": "http://books.google.com/books/content?id=123&printsec=frontcover"
                        }
                      }
                    }
                  ]
                }
                """;
            writeResponse(exchange, 200, "application/json", json);
        });
        server.start();

        IsbnLookupService service = createService(server, true);
        BookMetadataResponse response = service.lookupByIsbn("9780132350884");

        assertEquals("Clean Code", response.title());
        assertEquals("Robert C. Martin", response.author());
        assertEquals("Pearson", response.publisher());
        assertEquals(2008, response.publicationYear());
        assertEquals("https://books.google.com/books/content?id=123&printsec=frontcover", response.coverUrl());
        assertEquals("Google Books", response.source());

        // Now test 429 from Google Books still yields 404 ResourceNotFoundException cleanly
        server.removeContext("/gb/volumes");
        server.createContext("/gb/volumes", exchange -> writeResponse(exchange, 429, "application/json", "{\"error\":{}}"));
        server.createContext("/ol/isbn/9781449373320.json", exchange -> writeResponse(exchange, 404, "application/json", "{}"));

        assertThrows(ResourceNotFoundException.class, () -> service.lookupByIsbn("9781449373320"));
    }

    @Test
    void rejectsInvalidIsbnAndReportsBadGatewayWhenAllOpenLibraryCallsFail() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ol/api/books", exchange -> writeResponse(exchange, 503, "text/plain", "unavailable"));
        server.createContext("/ol/search.json", exchange -> writeResponse(exchange, 503, "text/plain", "unavailable"));
        server.createContext("/ol/isbn/9780132350884.json", exchange -> writeResponse(exchange, 503, "text/plain", "unavailable"));
        server.start();

        IsbnLookupService service = createService(server, false);

        ResponseStatusException badRequest = assertThrows(
                ResponseStatusException.class,
                () -> service.lookupByIsbn("not-an-isbn")
        );
        assertEquals(HttpStatus.BAD_REQUEST, badRequest.getStatusCode());

        ResponseStatusException badGateway = assertThrows(
                ResponseStatusException.class,
                () -> service.lookupByIsbn("9780132350884")
        );
        assertEquals(HttpStatus.BAD_GATEWAY, badGateway.getStatusCode());
    }
}
