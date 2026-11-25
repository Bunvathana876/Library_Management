package com.library.management.util;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class IsbnUtils {

    private static final Pattern ISBN_PREFIX_PATTERN = Pattern.compile("^(?i)isbn(?:[-\\s]?(?:10|13))?[:\\s-]*");
    private static final Pattern ISBN_10_PATTERN = Pattern.compile("^[0-9]{9}[0-9X]$");
    private static final Pattern ISBN_13_PATTERN = Pattern.compile("^(978|979)[0-9]{10}$");
    private static final Pattern YEAR_PATTERN = Pattern.compile("(?<!\\d)(1[4-9]\\d{2}|20\\d{2}|2100)(?!\\d)");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");

    private IsbnUtils() {
    }

    /**
     * Strips optional ISBN prefix, hyphens, and whitespace, returning uppercase ISBN characters or null if blank.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String withoutPrefix = ISBN_PREFIX_PATTERN.matcher(trimmed).replaceFirst("");
        String compact = withoutPrefix.replaceAll("[\\s-]+", "").toUpperCase(Locale.ROOT);
        return compact.isEmpty() ? null : compact;
    }

    public static boolean isValidIsbn10(String normalized) {
        if (normalized == null || !ISBN_10_PATTERN.matcher(normalized).matches()) {
            return false;
        }
        int sum = 0;
        for (int i = 0; i < 10; i++) {
            char ch = normalized.charAt(i);
            int digit = (ch == 'X') ? 10 : (ch - '0');
            sum += (10 - i) * digit;
        }
        return sum % 11 == 0;
    }

    public static boolean isValidIsbn13(String normalized) {
        if (normalized == null || !ISBN_13_PATTERN.matcher(normalized).matches()) {
            return false;
        }
        int sum = 0;
        for (int i = 0; i < 13; i++) {
            int digit = normalized.charAt(i) - '0';
            sum += (i % 2 == 0) ? digit : digit * 3;
        }
        return sum % 10 == 0;
    }

    public static boolean isValid(String raw) {
        String normalized = normalize(raw);
        return isValidIsbn10(normalized) || isValidIsbn13(normalized);
    }

    public static String normalizeAndValidate(String raw) {
        String normalized = normalize(raw);
        if (!isValidIsbn10(normalized) && !isValidIsbn13(normalized)) {
            throw new IllegalArgumentException("Invalid ISBN-10 or ISBN-13");
        }
        return normalized;
    }

    public static Integer extractPublicationYear(String rawDate) {
        if (rawDate == null || rawDate.isBlank()) {
            return null;
        }
        Matcher matcher = YEAR_PATTERN.matcher(rawDate);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return null;
    }

    public static String sanitizeCoverUrl(String rawUrl) {
        if (rawUrl == null) {
            return null;
        }
        String trimmed = rawUrl.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        for (int i = 0; i < trimmed.length(); i++) {
            char ch = trimmed.charAt(i);
            if (Character.isWhitespace(ch) || Character.isISOControl(ch)) {
                return null;
            }
        }

        if (trimmed.startsWith("http://covers.openlibrary.org/")) {
            trimmed = "https://" + trimmed.substring("http://".length());
        } else if (trimmed.startsWith("http://books.google.com/")) {
            trimmed = "https://" + trimmed.substring("http://".length());
        }

        if (trimmed.length() > 500) {
            return null;
        }

        if (trimmed.startsWith("/")) {
            return trimmed.startsWith("//") ? null : trimmed;
        }

        if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
            return null;
        }

        try {
            URI uri = URI.create(trimmed);
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                return null;
            }
            return trimmed;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static String truncate(String value, int maxLength) {
        if (value == null || maxLength <= 0) {
            return null;
        }
        String collapsed = WHITESPACE_PATTERN.matcher(value).replaceAll(" ").trim();
        if (collapsed.isEmpty()) {
            return null;
        }
        if (collapsed.length() <= maxLength) {
            return collapsed;
        }

        int searchEnd = Math.min(collapsed.length(), maxLength);
        int lastSpace = collapsed.lastIndexOf(' ', searchEnd);
        if (lastSpace > maxLength / 2) {
            String candidate = collapsed.substring(0, lastSpace).trim();
            if (!candidate.isEmpty()) {
                return candidate;
            }
        }
        return collapsed.substring(0, maxLength).trim();
    }

    public static String joinAuthors(List<String> authors, int maxLength) {
        if (authors == null || authors.isEmpty() || maxLength <= 0) {
            return null;
        }
        Set<String> unique = new LinkedHashSet<>();
        for (String author : authors) {
            if (author != null) {
                String cleaned = WHITESPACE_PATTERN.matcher(author).replaceAll(" ").trim();
                if (!cleaned.isEmpty()) {
                    unique.add(cleaned);
                }
            }
        }
        if (unique.isEmpty()) {
            return null;
        }

        List<String> list = List.copyOf(unique);
        String joined = String.join(", ", list);
        if (joined.length() <= maxLength) {
            return joined;
        }

        String etAlSuffix = " et al.";
        StringBuilder builder = new StringBuilder();
        int included = 0;
        for (String name : list) {
            String separator = included == 0 ? "" : ", ";
            int projectedLength = builder.length() + separator.length() + name.length();
            boolean hasMore = included + 1 < list.size();
            int reserved = hasMore ? etAlSuffix.length() : 0;
            if (projectedLength + reserved <= maxLength) {
                builder.append(separator).append(name);
                included++;
            } else {
                break;
            }
        }

        if (included > 0) {
            if (included < list.size() && builder.length() + etAlSuffix.length() <= maxLength) {
                builder.append(etAlSuffix);
            }
            return builder.toString();
        }

        return truncate(list.get(0), maxLength);
    }
}
