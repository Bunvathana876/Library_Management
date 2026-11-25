package com.library.management.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class IsbnUtilsTest {

    @Test
    void normalizesPrefixesHyphensAndCase() {
        assertEquals("9780132350884", IsbnUtils.normalize("  ISBN-13: 978-0-13-235088-4 "));
        assertEquals("080442957X", IsbnUtils.normalize("isbn 0-8044-2957-x"));
        assertNull(IsbnUtils.normalize("   "));
        assertNull(IsbnUtils.normalize(null));
    }

    @Test
    void validatesIsbn10AndIsbn13Checksums() {
        assertTrue(IsbnUtils.isValid("9780132350884"));
        assertTrue(IsbnUtils.isValid("978-1-4493-7332-0"));
        assertTrue(IsbnUtils.isValid("0134685997"));
        assertTrue(IsbnUtils.isValid("0-8044-2957-X"));

        assertFalse(IsbnUtils.isValid("9780132350885")); // bad ISBN-13 checksum
        assertFalse(IsbnUtils.isValid("0134685998"));    // bad ISBN-10 checksum
        assertFalse(IsbnUtils.isValid("9770132350884")); // invalid GS1 prefix
        assertFalse(IsbnUtils.isValid("12345"));

        assertEquals("080442957X", IsbnUtils.normalizeAndValidate("0-8044-2957-x"));
        assertThrows(IllegalArgumentException.class, () -> IsbnUtils.normalizeAndValidate("123"));
    }

    @Test
    void extractsPublicationYearFromVariousFormats() {
        assertEquals(2008, IsbnUtils.extractPublicationYear("July 2008"));
        assertEquals(2017, IsbnUtils.extractPublicationYear("Apr 02, 2017"));
        assertEquals(1999, IsbnUtils.extractPublicationYear("1999-05-12"));
        assertEquals(2024, IsbnUtils.extractPublicationYear("c2024."));
        assertNull(IsbnUtils.extractPublicationYear("Unknown date"));
        assertNull(IsbnUtils.extractPublicationYear("12345"));
    }

    @Test
    void sanitizesAndUpgradesCoverUrls() {
        assertEquals(
                "https://covers.openlibrary.org/b/id/15126503-L.jpg",
                IsbnUtils.sanitizeCoverUrl("http://covers.openlibrary.org/b/id/15126503-L.jpg")
        );
        assertEquals(
                "https://books.google.com/books/content?id=123",
                IsbnUtils.sanitizeCoverUrl("http://books.google.com/books/content?id=123")
        );
        assertEquals(
                "/images/catalog/cover-green-forest.webp",
                IsbnUtils.sanitizeCoverUrl("/images/catalog/cover-green-forest.webp")
        );

        assertNull(IsbnUtils.sanitizeCoverUrl("javascript:alert(1)"));
        assertNull(IsbnUtils.sanitizeCoverUrl("data:image/png;base64,abc"));
        assertNull(IsbnUtils.sanitizeCoverUrl("//evil.example.com/cover.jpg"));
        assertNull(IsbnUtils.sanitizeCoverUrl("https://example.com/bad cover.jpg"));
        assertNull(IsbnUtils.sanitizeCoverUrl("   "));
    }

    @Test
    void truncatesAndJoinsAuthorsCleanly() {
        assertEquals(
                "Clean Code",
                IsbnUtils.truncate("  Clean\n  Code\t", 200)
        );
        assertEquals(
                "Designing Data-Intensive",
                IsbnUtils.truncate("Designing Data-Intensive Applications", 27)
        );
        assertEquals(
                "Alice Author, Bob Writer",
                IsbnUtils.joinAuthors(List.of("Alice Author", "Alice Author", "Bob Writer"), 150)
        );
        assertEquals(
                "Alice Author et al.",
                IsbnUtils.joinAuthors(List.of("Alice Author", "Bob Writer", "Carol Editor"), 24)
        );
    }
}
