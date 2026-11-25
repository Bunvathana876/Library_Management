package com.library.management.repository;

import com.library.management.model.BookCopy;
import com.library.management.model.BookCopyStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BookCopyRepository extends JpaRepository<BookCopy, Long> {

    List<BookCopy> findAllByBookIdOrderByIdAsc(Long bookId);

    Optional<BookCopy> findFirstByBookIdAndStatusOrderByIdAsc(Long bookId, BookCopyStatus status);

    Optional<BookCopy> findByBarcodeIgnoreCase(String barcode);

    boolean existsByBarcodeIgnoreCase(String barcode);

    long countByBookIdAndStatus(Long bookId, BookCopyStatus status);

    List<BookCopy> findByBookIdIn(Collection<Long> bookIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT bc FROM BookCopy bc WHERE bc.id = :id")
    Optional<BookCopy> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT bc FROM BookCopy bc WHERE bc.book.id = :bookId AND bc.status = :status ORDER BY bc.id ASC")
    List<BookCopy> findAllByBookIdAndStatusOrderByIdAscForUpdate(
        @Param("bookId") Long bookId,
        @Param("status") BookCopyStatus status
    );

    @Query("""
        SELECT bc.book.id, bc.status, COUNT(bc)
        FROM BookCopy bc
        WHERE bc.book.id IN :bookIds
        GROUP BY bc.book.id, bc.status
        """)
    List<Object[]> countCopiesByBookIdsAndStatus(@Param("bookIds") Collection<Long> bookIds);
}
