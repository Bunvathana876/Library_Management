
package com.library.management.repository;

import com.library.management.model.Book;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BookRepository
        extends JpaRepository<Book, Long> {

    List<Book>
    findByTitleContainingIgnoreCaseOrAuthorContainingIgnoreCase(
        String title,
        String author
    );

    @Query("""
        SELECT b FROM Book b
        WHERE LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(b.author) LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(COALESCE(b.publisher, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(COALESCE(b.category, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(COALESCE(b.shelfLocation, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
           OR LOWER(COALESCE(b.isbn, '')) LIKE LOWER(CONCAT('%', :normalizedKeyword, '%'))
        """)
    List<Book> searchBooks(
        @Param("keyword") String keyword,
        @Param("normalizedKeyword") String normalizedKeyword
    );

    @Query("""
        SELECT DISTINCT b.category
        FROM Book b
        WHERE b.category IS NOT NULL AND TRIM(b.category) <> ''
        ORDER BY b.category ASC
        """)
    List<String> findDistinctCategories();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Book b WHERE b.id = :id")
    Optional<Book> findByIdForUpdate(@Param("id") Long id);
}
