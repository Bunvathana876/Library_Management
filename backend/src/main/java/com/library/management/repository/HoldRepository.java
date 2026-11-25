package com.library.management.repository;

import com.library.management.model.Hold;
import com.library.management.model.HoldStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface HoldRepository extends JpaRepository<Hold, Long> {

    Optional<Hold> findFirstByBookIdAndStatusOrderByPlacedAtAscIdAsc(Long bookId, HoldStatus status);

    List<Hold> findAllByBookIdAndStatusOrderByPlacedAtAscIdAsc(Long bookId, HoldStatus status);

    List<Hold> findAllByBookIdAndStatusInOrderByPlacedAtAscIdAsc(Long bookId, Collection<HoldStatus> statuses);

    boolean existsByBookIdAndStatusIn(Long bookId, Collection<HoldStatus> statuses);

    boolean existsByBookIdAndMemberIdAndStatusIn(Long bookId, Long memberId, Collection<HoldStatus> statuses);

    List<Hold> findAllByStatusInOrderByPlacedAtAscIdAsc(Collection<HoldStatus> statuses);

    List<Hold> findAllByMemberIdAndStatusInOrderByPlacedAtDescIdDesc(Long memberId, Collection<HoldStatus> statuses);

    List<Hold> findAllByStatusAndExpiresOnBefore(HoldStatus status, LocalDate date);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM Hold h WHERE h.id = :id")
    Optional<Hold> findByIdForUpdate(@Param("id") Long id);

    @Query("""
        SELECT h.book.id, COUNT(h)
        FROM Hold h
        WHERE h.book.id IN :bookIds AND h.status IN :statuses
        GROUP BY h.book.id
        """)
    List<Object[]> countActiveHoldsByBookIds(
        @Param("bookIds") Collection<Long> bookIds,
        @Param("statuses") Collection<HoldStatus> statuses
    );

    @Query("SELECT DISTINCT h.book.id FROM Hold h WHERE h.status IN :statuses")
    Set<Long> findBookIdsByStatusIn(@Param("statuses") Collection<HoldStatus> statuses);

    @Query("SELECT DISTINCT h.book.id FROM Hold h WHERE h.status = :status")
    Set<Long> findBookIdsByStatus(@Param("status") HoldStatus status);
}
