package com.library.management;

import com.library.management.model.*;
import com.library.management.repository.AppUserRepository;
import com.library.management.service.*;
import com.library.management.dto.ChangePasswordRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TokenRevocationIntegrationTest extends PostgresIntegrationTest {
    @Autowired AppUserRepository users;
    @Autowired AccountService accounts;
    @Autowired JwtService tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired MockMvc mvc;

    private AppUser user(String prefix) {
        return users.save(new AppUser(prefix + "@revocation.test", encoder.encode("OriginalPassword123!"), UserRole.LIBRARIAN));
    }
    private String token(AppUser user) {
        return tokens.createToken(new UsernamePasswordAuthenticationToken(user.getEmail(), null,
            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
    }
    private void accepted(String token) throws Exception {
        mvc.perform(get("/api/members").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }
    private void rejected(String token) throws Exception {
        mvc.perform(get("/api/members").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    @Test
    void disabledThenReenabledAccountCannotReuseOldToken() throws Exception {
        AppUser user = user("disabled"); String old = token(user); accepted(old);
        accounts.updateStatus(user.getId(), false, "admin@test.local"); rejected(old);
        accounts.updateStatus(user.getId(), true, "admin@test.local"); rejected(old);
        accepted(token(users.findById(user.getId()).orElseThrow()));
    }
    @Test
    void roleChangeImmediatelyRevokesStaffPermissions() throws Exception {
        AppUser user = user("role"); String old = token(user); accepted(old);
        accounts.updateRole(user.getId(), UserRole.MEMBER, "admin@test.local"); rejected(old);
        mvc.perform(get("/api/members").header("Authorization", "Bearer " + token(users.findById(user.getId()).orElseThrow())))
            .andExpect(status().isForbidden());
    }
    @Test
    void passwordResetAndOwnChangeRevokeExistingSessions() throws Exception {
        AppUser user = user("password"); String old = token(user); accepted(old);
        accounts.resetPassword(user.getId(), "ResetPassword123!"); rejected(old);
        String reset = token(users.findById(user.getId()).orElseThrow()); accepted(reset);
        accounts.changeOwnPassword(user.getEmail(), new ChangePasswordRequest("ResetPassword123!", "ChangedPassword123!"));
        rejected(reset);
        accepted(token(users.findById(user.getId()).orElseThrow()));
    }
}
