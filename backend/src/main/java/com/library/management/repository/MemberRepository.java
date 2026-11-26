package com.library.management.repository;

import com.library.management.model.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member,Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT m FROM Member m WHERE m.id = :id")
    Optional<Member> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    Optional<Member> findByAccountId(Long accountId);

    boolean existsByEmail(String email);

    Optional<Member> findByEmailIgnoreCase(String email);
}
