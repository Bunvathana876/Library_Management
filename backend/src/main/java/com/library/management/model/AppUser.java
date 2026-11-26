
package com.library.management.model;

import jakarta.persistence.*;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "token_version", nullable = false, length = 36)
    private String tokenVersion = "0";

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    public String getTokenVersion() { return tokenVersion; }

    private void revokeTokens() { tokenVersion = java.util.UUID.randomUUID().toString(); }

    protected AppUser() {}

    public AppUser(
            String email,
            String passwordHash,
            UserRole role
    ) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    public Long getId() { return id; }

    public String getEmail() { return email; }

    public void changeEmail(String email) {
        if (!this.email.equals(email)) revokeTokens();
        this.email = email;
    }

    public String getPasswordHash() { return passwordHash; }

    public UserRole getRole() { return role; }

    public boolean isEnabled() { return enabled; }

    public void setEnabled(boolean enabled) {
        if (this.enabled != enabled) revokeTokens();
        this.enabled = enabled;
    }

    public void setRole(UserRole role) {
        if (this.role != role) revokeTokens();
        this.role = role;
    }

    public void setPasswordHash(String passwordHash) {
        revokeTokens();
        this.passwordHash = passwordHash;
    }
}
