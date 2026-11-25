package com.library.management.service;

import com.library.management.dto.BookMetadataResponse;
import com.library.management.exception.ResourceNotFoundException;
import com.library.management.util.IsbnUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Service
public class IsbnLookupService {

    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_AUTHOR_LENGTH = 150;
    private static final int MAX_PUBLISHER_LENGTH = 150;
    private static final int MAX_CACHE_ENTRIES = 256;
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    private static final String USER_AGENT = "AthenaeumLibraryManagement/1.0 (ISBN Auto-Fill)";
    private static final Pattern SAFE_AUTHOR_KEY = Pattern.compile("^/authors/[A-Za-z0-9_-]+$");

    private final ObjectMapper objectMapper;
    private final String openLibraryBaseUrl;
    private final String openLibraryCoversBaseUrl;
    private final String googleBooksBaseUrl;
    private final String googleBooksApiKey;
    private final Duration readTimeout;
    private final HttpClient httpClient;
    private final HttpClient headClient;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public IsbnLookupService(
            ObjectMapper objectMapper,
            @Value("${app.isbn.open-library.base-url:https://openlibrary.org}") String openLibraryBaseUrl,
            @Value("${app.isbn.open-library.covers-base-url:https://covers.openlibrary.org}") String openLibraryCoversBaseUrl,
            @Value("${app.isbn.google-books.base-url:https://www.googleapis.com/books/v1}") String googleBooksBaseUrl,
            @Value("${app.isbn.google-books.api-key:}") String googleBooksApiKey,
            @Value("${app.isbn.connect-timeout-ms:4000}") long connectTimeoutMs,
            @Value("${app.isbn.read-timeout-ms:6000}") long readTimeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.openLibraryBaseUrl = stripTrailingSlash(openLibraryBaseUrl);
        this.openLibraryCoversBaseUrl = stripTrailingSlash(openLibraryCoversBaseUrl);
        this.googleBooksBaseUrl = stripTrailingSlash(googleBooksBaseUrl);
        this.googleBooksApiKey = googleBooksApiKey == null ? "" : googleBooksApiKey.strip();
        long safeConnectMs = Math.max(500L, connectTimeoutMs);
        long safeReadMs = Math.max(500L, readTimeoutMs);
        this.readTimeout = Duration.ofMillis(safeReadMs);
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofMillis(safeConnectMs))
                .build();
        this.headClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofMillis(safeConnectMs))
                .build();
    }

    public BookMetadataResponse lookupByIsbn(String rawIsbn) {
        final String normalizedIsbn;
        try {
            normalizedIsbn = IsbnUtils.normalizeAndValidate(rawIsbn);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Please enter a valid 10- or 13-digit ISBN."
            );
        }

        BookMetadataResponse cached = getCached(normalizedIsbn);
        if (cached != null) {
            return cached;
        }

        MetadataAccumulator accumulator = new MetadataAccumulator(normalizedIsbn);
        boolean openLibraryReachable = false;
        boolean openLibraryErrored = false;

        // 1. Primary: Open Library Books API
        UpstreamResult primaryResult = fetchOpenLibraryBooksApi(normalizedIsbn, accumulator);
        openLibraryReachable |= primaryResult.reachable();
        openLibraryErrored |= primaryResult.errored();

        // 2. Enrichment / Fallback 1: Open Library Search API if any useful field is still missing
        if (accumulator.needsEnrichment()) {
            UpstreamResult searchResult = fetchOpenLibrarySearchApi(normalizedIsbn, accumulator);
            openLibraryReachable |= searchResult.reachable();
            openLibraryErrored |= searchResult.errored();
        }

        // 3. Fallback 2: Open Library Edition API when title is still missing
        if (accumulator.title == null) {
            UpstreamResult editionResult = fetchOpenLibraryEditionApi(normalizedIsbn, accumulator);
            openLibraryReachable |= editionResult.reachable();
            openLibraryErrored |= editionResult.errored();
        }

        // 4. Verified cover fallback via HEAD request when metadata exists but cover URL is missing
        if (accumulator.title != null && accumulator.coverUrl == null) {
            accumulator.coverUrl = verifyIsbnCoverUrl(accumulator.canonicalIsbn, normalizedIsbn);
        }

        // 5. Optional Fallback 3: Google Books API if Open Library returned no match
        if (accumulator.title == null && !googleBooksBaseUrl.isEmpty()) {
            fetchGoogleBooksApi(normalizedIsbn, accumulator);
        }

        if (accumulator.title == null) {
            if (!openLibraryReachable && openLibraryErrored) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Unable to reach Open Library right now. You can retry or enter book details manually."
                );
            }
            throw new ResourceNotFoundException("No book metadata found for ISBN " + normalizedIsbn);
        }

        BookMetadataResponse response = accumulator.toResponse();
        putCache(normalizedIsbn, response);
        return response;
    }

    private UpstreamResult fetchOpenLibraryBooksApi(String isbn, MetadataAccumulator acc) {
        String url = openLibraryBaseUrl
                + "/api/books?bibkeys="
                + encodeQuery("ISBN:" + isbn)
                + "&format=json&jscmd=data";

        HttpJsonResult result = executeGetJson(url);
        if (result.networkOrServerError()) {
            return new UpstreamResult(false, true);
        }
        if (!result.ok() || result.json() == null) {
            return new UpstreamResult(result.httpStatus() > 0 && result.httpStatus() < 500, false);
        }

        JsonNode entry = result.json().get("ISBN:" + isbn);
        if (entry == null || !entry.isObject()) {
            return new UpstreamResult(true, false);
        }

        acc.markSource("Open Library");
        acc.fillTitle(extractText(entry.get("title")));

        List<String> authorNames = new ArrayList<>();
        JsonNode authorsNode = entry.get("authors");
        if (authorsNode != null && authorsNode.isArray()) {
            for (JsonNode authorObj : authorsNode) {
                if (authorObj != null && authorObj.isObject()) {
                    String name = extractText(authorObj.get("name"));
                    if (name != null) {
                        authorNames.add(name);
                    }
                }
            }
        }
        acc.fillAuthor(IsbnUtils.joinAuthors(authorNames, MAX_AUTHOR_LENGTH));

        JsonNode publishersNode = entry.get("publishers");
        if (publishersNode != null && publishersNode.isArray()) {
            for (JsonNode pubNode : publishersNode) {
                String pubName = pubNode != null && pubNode.isObject()
                        ? extractText(pubNode.get("name"))
                        : extractText(pubNode);
                if (pubName != null) {
                    acc.fillPublisher(pubName);
                    break;
                }
            }
        }

        acc.fillPublicationYear(IsbnUtils.extractPublicationYear(extractText(entry.get("publish_date"))));

        JsonNode identifiersNode = entry.get("identifiers");
        if (identifiersNode != null && identifiersNode.isObject()) {
            JsonNode isbn13Array = identifiersNode.get("isbn_13");
            if (isbn13Array != null && isbn13Array.isArray()) {
                for (JsonNode item : isbn13Array) {
                    String candidate = IsbnUtils.normalize(extractText(item));
                    if (IsbnUtils.isValidIsbn13(candidate)) {
                        acc.preferCanonicalIsbn(candidate);
                        break;
                    }
                }
            }
        }

        JsonNode coverNode = entry.get("cover");
        if (coverNode != null && coverNode.isObject()) {
            String coverCandidate = firstNonNull(
                    IsbnUtils.sanitizeCoverUrl(extractText(coverNode.get("large"))),
                    IsbnUtils.sanitizeCoverUrl(extractText(coverNode.get("medium"))),
                    IsbnUtils.sanitizeCoverUrl(extractText(coverNode.get("small")))
            );
            acc.fillCoverUrl(coverCandidate);
        }

        return new UpstreamResult(true, false);
    }

    private UpstreamResult fetchOpenLibrarySearchApi(String isbn, MetadataAccumulator acc) {
        String url = openLibraryBaseUrl
                + "/search.json?isbn="
                + encodeQuery(isbn)
                + "&fields=title,author_name,first_publish_year,publish_year,publisher,cover_i,isbn&limit=1";

        HttpJsonResult result = executeGetJson(url);
        if (result.networkOrServerError()) {
            return new UpstreamResult(false, true);
        }
        if (!result.ok() || result.json() == null) {
            return new UpstreamResult(result.httpStatus() > 0 && result.httpStatus() < 500, false);
        }

        JsonNode docs = result.json().get("docs");
        if (docs == null || !docs.isArray() || docs.isEmpty()) {
            return new UpstreamResult(true, false);
        }

        JsonNode doc = docs.get(0);
        if (doc == null || !doc.isObject()) {
            return new UpstreamResult(true, false);
        }

        acc.markSource("Open Library");
        acc.fillTitle(extractText(doc.get("title")));

        List<String> authors = new ArrayList<>();
        JsonNode authorNameArray = doc.get("author_name");
        if (authorNameArray != null && authorNameArray.isArray()) {
            for (JsonNode authorNode : authorNameArray) {
                String name = extractText(authorNode);
                if (name != null) {
                    authors.add(name);
                }
            }
        }
        acc.fillAuthor(IsbnUtils.joinAuthors(authors, MAX_AUTHOR_LENGTH));

        JsonNode publisherNode = doc.get("publisher");
        if (publisherNode != null && publisherNode.isArray()) {
            for (JsonNode pubItem : publisherNode) {
                String pub = extractText(pubItem);
                if (pub != null) {
                    acc.fillPublisher(pub);
                    break;
                }
            }
        } else {
            acc.fillPublisher(extractText(publisherNode));
        }

        Integer year = extractPositiveInt(doc.get("first_publish_year"));
        if (year == null) {
            JsonNode publishYearArray = doc.get("publish_year");
            if (publishYearArray != null && publishYearArray.isArray()) {
                for (JsonNode yearNode : publishYearArray) {
                    Integer candidate = extractPositiveInt(yearNode);
                    if (candidate != null) {
                        year = candidate;
                        break;
                    }
                }
            }
        }
        acc.fillPublicationYear(year);

        Integer coverId = extractPositiveInt(doc.get("cover_i"));
        if (coverId != null) {
            acc.fillCoverUrl(buildCoverByIdUrl(coverId));
        }

        return new UpstreamResult(true, false);
    }

    private UpstreamResult fetchOpenLibraryEditionApi(String isbn, MetadataAccumulator acc) {
        String url = openLibraryBaseUrl + "/isbn/" + encodeQuery(isbn) + ".json";
        HttpJsonResult result = executeGetJson(url);
        if (result.networkOrServerError()) {
            return new UpstreamResult(false, true);
        }
        if (!result.ok() || result.json() == null || !result.json().isObject()) {
            return new UpstreamResult(result.httpStatus() > 0 && result.httpStatus() < 500, false);
        }

        JsonNode edition = result.json();
        String editionTitle = extractText(edition.get("title"));
        if (editionTitle == null) {
            return new UpstreamResult(true, false);
        }

        acc.markSource("Open Library");
        acc.fillTitle(editionTitle);

        JsonNode publishersNode = edition.get("publishers");
        if (publishersNode != null && publishersNode.isArray()) {
            for (JsonNode pubItem : publishersNode) {
                String pub = extractText(pubItem);
                if (pub != null) {
                    acc.fillPublisher(pub);
                    break;
                }
            }
        }

        acc.fillPublicationYear(IsbnUtils.extractPublicationYear(extractText(edition.get("publish_date"))));

        JsonNode isbn13Array = edition.get("isbn_13");
        if (isbn13Array != null && isbn13Array.isArray()) {
            for (JsonNode isbnNode : isbn13Array) {
                String candidate = IsbnUtils.normalize(extractText(isbnNode));
                if (IsbnUtils.isValidIsbn13(candidate)) {
                    acc.preferCanonicalIsbn(candidate);
                    break;
                }
            }
        }

        JsonNode coversArray = edition.get("covers");
        if (coversArray != null && coversArray.isArray()) {
            for (JsonNode coverNode : coversArray) {
                Integer coverId = extractPositiveInt(coverNode);
                if (coverId != null) {
                    acc.fillCoverUrl(buildCoverByIdUrl(coverId));
                    break;
                }
            }
        }

        List<String> resolvedAuthors = new ArrayList<>();
        JsonNode authorsArray = edition.get("authors");
        if (authorsArray != null && authorsArray.isArray()) {
            int resolvedCount = 0;
            for (JsonNode authorRef : authorsArray) {
                if (resolvedCount >= 3) {
                    break;
                }
                String key = authorRef != null && authorRef.isObject() ? extractText(authorRef.get("key")) : null;
                if (key != null && SAFE_AUTHOR_KEY.matcher(key).matches()) {
                    resolvedCount++;
                    HttpJsonResult authorResult = executeGetJson(openLibraryBaseUrl + key + ".json");
                    if (authorResult.ok() && authorResult.json() != null) {
                        String authorName = extractText(authorResult.json().get("name"));
                        if (authorName != null) {
                            resolvedAuthors.add(authorName);
                        }
                    }
                }
            }
        }
        String joinedAuthors = IsbnUtils.joinAuthors(resolvedAuthors, MAX_AUTHOR_LENGTH);
        if (joinedAuthors == null) {
            joinedAuthors = extractText(edition.get("by_statement"));
        }
        acc.fillAuthor(joinedAuthors);

        return new UpstreamResult(true, false);
    }

    private void fetchGoogleBooksApi(String isbn, MetadataAccumulator acc) {
        StringBuilder url = new StringBuilder(googleBooksBaseUrl)
                .append("/volumes?q=isbn:")
                .append(encodeQuery(isbn));
        if (!googleBooksApiKey.isEmpty()) {
            url.append("&key=").append(encodeQuery(googleBooksApiKey));
        }

        HttpJsonResult result = executeGetJson(url.toString());
        if (!result.ok() || result.json() == null) {
            return;
        }

        JsonNode items = result.json().get("items");
        if (items == null || !items.isArray() || items.isEmpty()) {
            return;
        }

        JsonNode volume = items.get(0);
        if (volume == null || !volume.isObject()) {
            return;
        }

        JsonNode info = volume.get("volumeInfo");
        if (info == null || !info.isObject()) {
            return;
        }

        String title = extractText(info.get("title"));
        if (title == null) {
            return;
        }

        acc.markSource("Google Books");
        acc.fillTitle(title);

        List<String> authors = new ArrayList<>();
        JsonNode authorsNode = info.get("authors");
        if (authorsNode != null && authorsNode.isArray()) {
            for (JsonNode authorNode : authorsNode) {
                String name = extractText(authorNode);
                if (name != null) {
                    authors.add(name);
                }
            }
        }
        acc.fillAuthor(IsbnUtils.joinAuthors(authors, MAX_AUTHOR_LENGTH));
        acc.fillPublisher(extractText(info.get("publisher")));
        acc.fillPublicationYear(IsbnUtils.extractPublicationYear(extractText(info.get("publishedDate"))));

        JsonNode imageLinks = info.get("imageLinks");
        if (imageLinks != null && imageLinks.isObject()) {
            String coverCandidate = firstNonNull(
                    IsbnUtils.sanitizeCoverUrl(extractText(imageLinks.get("thumbnail"))),
                    IsbnUtils.sanitizeCoverUrl(extractText(imageLinks.get("smallThumbnail")))
            );
            acc.fillCoverUrl(coverCandidate);
        }
    }

    private String verifyIsbnCoverUrl(String canonicalIsbn, String queriedIsbn) {
        if (openLibraryCoversBaseUrl.isEmpty()) {
            return null;
        }

        String primaryCoverUrl = buildCoverByIsbnUrl(canonicalIsbn);
        if (isCoverAvailable(primaryCoverUrl)) {
            return primaryCoverUrl;
        }

        if (!canonicalIsbn.equals(queriedIsbn)) {
            String fallbackCoverUrl = buildCoverByIsbnUrl(queriedIsbn);
            if (isCoverAvailable(fallbackCoverUrl)) {
                return fallbackCoverUrl;
            }
        }
        return null;
    }

    private boolean isCoverAvailable(String url) {
        String sanitized = IsbnUtils.sanitizeCoverUrl(url);
        if (sanitized == null) {
            return false;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(sanitized))
                    .timeout(readTimeout)
                    .header("User-Agent", USER_AGENT)
                    .method("HEAD", HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<Void> response = headClient.send(request, HttpResponse.BodyHandlers.discarding());
            int status = response.statusCode();
            return status == 200 || status == 301 || status == 302;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        } catch (IOException | IllegalArgumentException ex) {
            return false;
        }
    }

    private String buildCoverByIdUrl(int coverId) {
        if (openLibraryCoversBaseUrl.isEmpty() || coverId <= 0) {
            return null;
        }
        return IsbnUtils.sanitizeCoverUrl(
                openLibraryCoversBaseUrl + "/b/id/" + coverId + "-L.jpg?default=false"
        );
    }

    private String buildCoverByIsbnUrl(String isbn) {
        if (openLibraryCoversBaseUrl.isEmpty() || isbn == null || isbn.isBlank()) {
            return null;
        }
        return IsbnUtils.sanitizeCoverUrl(
                openLibraryCoversBaseUrl + "/b/isbn/" + isbn + "-L.jpg?default=false"
        );
    }

    private HttpJsonResult executeGetJson(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(readTimeout)
                    .header("Accept", "application/json")
                    .header("User-Agent", USER_AGENT)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                String body = response.body();
                if (body == null || body.isBlank()) {
                    return new HttpJsonResult(status, null, false);
                }
                JsonNode tree = objectMapper.readTree(body);
                return new HttpJsonResult(status, tree, false);
            }
            if (status >= 500) {
                return new HttpJsonResult(status, null, true);
            }
            return new HttpJsonResult(status, null, false);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new HttpJsonResult(0, null, true);
        } catch (Exception ex) {
            return new HttpJsonResult(0, null, true);
        }
    }

    private BookMetadataResponse getCached(String normalizedIsbn) {
        CacheEntry entry = cache.get(normalizedIsbn);
        if (entry == null) {
            return null;
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            cache.remove(normalizedIsbn, entry);
            return null;
        }
        return entry.response();
    }

    private void putCache(String normalizedIsbn, BookMetadataResponse response) {
        Instant now = Instant.now();
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.entrySet().removeIf(item -> now.isAfter(item.getValue().expiresAt()));
            if (cache.size() >= MAX_CACHE_ENTRIES) {
                String firstKey = cache.keySet().stream().findFirst().orElse(null);
                if (firstKey != null) {
                    cache.remove(firstKey);
                }
            }
        }
        cache.put(normalizedIsbn, new CacheEntry(response, now.plus(CACHE_TTL)));
    }

    private static String extractText(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode() || !node.isString()) {
            return null;
        }
        String value = node.asString();
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Integer extractPositiveInt(JsonNode node) {
        if (node == null || !node.isNumber()) {
            return null;
        }
        int val = node.asInt(0);
        return val > 0 ? val : null;
    }

    private static String firstNonNull(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String stripTrailingSlash(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.strip();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static String encodeQuery(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record CacheEntry(BookMetadataResponse response, Instant expiresAt) {
    }

    private record UpstreamResult(boolean reachable, boolean errored) {
    }

    private record HttpJsonResult(int httpStatus, JsonNode json, boolean networkOrServerError) {
        boolean ok() {
            return httpStatus >= 200 && httpStatus < 300;
        }
    }

    private static final class MetadataAccumulator {
        private String canonicalIsbn;
        private String title;
        private String author;
        private Integer publicationYear;
        private String publisher;
        private String coverUrl;
        private String source;

        MetadataAccumulator(String normalizedIsbn) {
            this.canonicalIsbn = normalizedIsbn;
        }

        boolean needsEnrichment() {
            return title == null
                    || author == null
                    || publicationYear == null
                    || publisher == null
                    || coverUrl == null;
        }

        void markSource(String sourceName) {
            if (this.source == null) {
                this.source = sourceName;
            }
        }

        void preferCanonicalIsbn(String isbn13) {
            if (!IsbnUtils.isValidIsbn13(this.canonicalIsbn)
                    && isbn13 != null
                    && IsbnUtils.isValidIsbn13(isbn13)) {
                this.canonicalIsbn = isbn13;
            }
        }

        void fillTitle(String value) {
            if (this.title == null) {
                this.title = IsbnUtils.truncate(value, MAX_TITLE_LENGTH);
            }
        }

        void fillAuthor(String value) {
            if (this.author == null) {
                this.author = IsbnUtils.truncate(value, MAX_AUTHOR_LENGTH);
            }
        }

        void fillPublisher(String value) {
            if (this.publisher == null) {
                this.publisher = IsbnUtils.truncate(value, MAX_PUBLISHER_LENGTH);
            }
        }

        void fillPublicationYear(Integer year) {
            if (this.publicationYear == null && year != null && year > 0) {
                this.publicationYear = year;
            }
        }

        void fillCoverUrl(String url) {
            if (this.coverUrl == null && url != null) {
                this.coverUrl = IsbnUtils.sanitizeCoverUrl(url);
            }
        }

        BookMetadataResponse toResponse() {
            return new BookMetadataResponse(
                    canonicalIsbn,
                    title,
                    author,
                    publicationYear,
                    publisher,
                    coverUrl,
                    source != null ? source : "Open Library"
            );
        }
    }
}
