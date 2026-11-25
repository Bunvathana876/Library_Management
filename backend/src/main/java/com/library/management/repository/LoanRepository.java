package com.library.management.repository;

import com.library.management.model.FineStatus;
import com.library.management.model.Loan;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LoanRepository extends JpaRepository<Loan, Long> {
    List<Loan> findAllByReturnedOnIsNullOrderByDueOnAsc();

    List<Loan>
    findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(
        LocalDate today
    );

    List<Loan> findAllByReturnedOnIsNullAndDueOnBetweenOrderByDueOnAsc(
        LocalDate startInclusive,
        LocalDate endInclusive
    );

    boolean existsByBookIdAndReturnedOnIsNull(Long bookId);

    boolean existsByBookIdAndMemberIdAndReturnedOnIsNull(Long bookId, Long memberId);

    long countByMemberIdAndReturnedOnIsNull(Long memberId);

    boolean existsByMemberId(Long memberId);

    List<Loan> findAllByMemberIdAndReturnedOnIsNullOrderByDueOnAsc(Long memberId);

    List<Loan> findAllByMemberIdAndReturnedOnIsNotNullOrderByReturnedOnDescIdDesc(Long memberId);

    List<Loan> findAllByMemberIdAndFineStatus(Long memberId, FineStatus fineStatus);

    List<Loan> findAllByMemberIdAndFineStatusNotOrderByIdDesc(Long memberId, FineStatus fineStatus);

    List<Loan> findAllByFineStatusNotOrderByIdDesc(FineStatus fineStatus);

    void deleteAllByMemberId(Long memberId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM Loan l WHERE l.id = :id")
    Optional<Loan> findByIdForUpdate(@Param("id") Long id);
}
