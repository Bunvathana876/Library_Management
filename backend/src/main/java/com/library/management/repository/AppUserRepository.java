
package com.library.management.repository;

import com.library.management.model.AppUser;
import com.library.management.model.UserRole;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository
        extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from AppUser u where lower(u.email) = lower(:email)")
    Optional<AppUser> findByEmailForUpdate(@org.springframework.data.repository.query.Param("email") String email);

    boolean existsByEmail(String email);

    boolean existsByRole(UserRole role);

    long countByRoleAndEnabledTrue(UserRole role);
}
