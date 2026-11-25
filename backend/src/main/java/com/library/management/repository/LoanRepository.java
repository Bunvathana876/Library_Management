package com.library.management.repository;

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

    boolean existsByBookIdAndReturnedOnIsNull(Long bookId);

    boolean existsByBookIdAndMemberIdAndReturnedOnIsNull(Long bookId, Long memberId);

    List<Loan> findAllByMemberIdAndReturnedOnIsNullOrderByDueOnAsc(Long memberId);

    List<Loan> findAllByMemberIdAndReturnedOnIsNotNullOrderByReturnedOnDescIdDesc(Long memberId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM Loan l WHERE l.id = :id")
    Optional<Loan> findByIdForUpdate(@Param("id") Long id);
}
