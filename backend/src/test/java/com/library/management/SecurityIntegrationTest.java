package com.library.management;

import com.library.management.model.AppUser;
import com.library.management.model.UserRole;
import com.library.management.repository.AppUserRepository;
import com.library.management.repository.HoldRepository;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.MemberRepository;
import com.library.management.repository.NotificationRepository;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SecurityIntegrationTest extends PostgresIntegrationTest {

    private static final String TEST_ADMIN_EMAIL = "test-sec-admin@library.local";
    private static final String TEST_LIBRARIAN_EMAIL = "test-sec-librarian@library.local";
    private static final String TEST_MEMBER_EMAIL = "test-sec-member@library.local";
    private static final String TEST_CREATED_EMAIL = "test-sec-created@library.local";
    private static final String TEST_PASSWORD = "TestPassword123!";

    private static final List<String> TEST_EMAILS = List.of(
        TEST_ADMIN_EMAIL,
        TEST_LIBRARIAN_EMAIL,
        TEST_MEMBER_EMAIL,
        TEST_CREATED_EMAIL
    );

    @LocalServerPort
    private int port;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private HoldRepository holdRepository;

    @Autowired
    private LoanRepository loanRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @BeforeEach
    void setUp() {
        cleanupTestUsers();
        String hash = passwordEncoder.encode(TEST_PASSWORD);
        appUserRepository.save(new AppUser(TEST_ADMIN_EMAIL, hash, UserRole.ADMIN));
        appUserRepository.save(new AppUser(TEST_LIBRARIAN_EMAIL, hash, UserRole.LIBRARIAN));
        appUserRepository.save(new AppUser(TEST_MEMBER_EMAIL, hash, UserRole.MEMBER));
    }

    @AfterEach
    void tearDown() {
        cleanupTestUsers();
    }

    private void cleanupTestUsers() {
        transactionTemplate.executeWithoutResult(status -> {
            for (String email : TEST_EMAILS) {
                notificationRepository.deleteAllByRecipientEmailIgnoreCase(email);
                memberRepository.findByEmailIgnoreCase(email)
                    .ifPresent(member -> {
                        holdRepository.deleteAllByMemberId(member.getId());
                        loanRepository.deleteAllByMemberId(member.getId());
                        memberRepository.delete(member);
                    });
                appUserRepository.findByEmail(email)
                    .ifPresent(appUserRepository::delete);
            }
        });
    }

    private HttpResponse<String> send(
            String method,
            String path,
            String jsonBody,
            String token
    ) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:" + port + path));

        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }

        if (jsonBody != null) {
            builder.header("Content-Type", "application/json");
            builder.method(method, HttpRequest.BodyPublishers.ofString(jsonBody));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String loginAndGetToken(String email) throws IOException, InterruptedException {
        HttpResponse<String> response = send(
            "POST",
            "/api/auth/login",
            """
            {"email":"%s","password":"%s"}
            """.formatted(email, TEST_PASSWORD),
            null
        );
        assertEquals(200, response.statusCode());
        return objectMapper.readTree(response.body()).get("accessToken").asString();
    }

    @Test
    void publicEndpointsAndAuthRequirements() throws Exception {
        assertEquals(200, send("GET", "/api/books", null, null).statusCode());
        assertEquals(401, send("GET", "/api/members", null, null).statusCode());
        assertEquals(401, send("GET", "/api/auth/me", null, null).statusCode());
    }

    @Test
    void loginReturnsCleanRolesWithoutFactorPasswordAndProperErrorOnBadPassword() throws Exception {
        HttpResponse<String> badLogin = send(
            "POST",
            "/api/auth/login",
            """
            {"email":"%s","password":"WrongPassword123!"}
            """.formatted(TEST_ADMIN_EMAIL),
            null
        );
        assertEquals(401, badLogin.statusCode());
        JsonNode badLoginJson = objectMapper.readTree(badLogin.body());
        assertEquals("Invalid email or password", badLoginJson.get("detail").asString());

        HttpResponse<String> login = send(
            "POST",
            "/api/auth/login",
            """
            {"email":"%s","password":"%s"}
            """.formatted(TEST_ADMIN_EMAIL, TEST_PASSWORD),
            null
        );
        assertEquals(200, login.statusCode());
        JsonNode loginJson = objectMapper.readTree(login.body());
        assertEquals("Bearer", loginJson.get("tokenType").asString());
        assertEquals(1800L, loginJson.get("expiresInSeconds").asLong());
        String token = loginJson.get("accessToken").asString();
        assertFalse(token.isBlank());

        HttpResponse<String> me = send("GET", "/api/auth/me", null, token);
        assertEquals(200, me.statusCode());
        JsonNode meJson = objectMapper.readTree(me.body());
        assertEquals(TEST_ADMIN_EMAIL, meJson.get("email").asString());
        assertEquals(1, meJson.get("roles").size());
        assertEquals("ADMIN", meJson.get("roles").get(0).asString());
    }

    @Test
    void adminUserCreationAndErrorResponsesPreserveHttpStatus() throws Exception {
        String adminToken = loginAndGetToken(TEST_ADMIN_EMAIL);
        String librarianToken = loginAndGetToken(TEST_LIBRARIAN_EMAIL);

        HttpResponse<String> createAdminAttempt = send(
            "POST",
            "/api/admin/users",
            """
            {"email":"%s","password":"ValidPassword123!","role":"ADMIN"}
            """.formatted(TEST_CREATED_EMAIL),
            adminToken
        );
        assertEquals(400, createAdminAttempt.statusCode());
        assertEquals(
            "Admin accounts cannot be created here",
            objectMapper.readTree(createAdminAttempt.body()).get("detail").asString()
        );

        String createLibrarianPayload = """
            {"email":"%s","password":"ValidPassword123!","role":"LIBRARIAN"}
            """.formatted(TEST_CREATED_EMAIL);

        HttpResponse<String> created = send("POST", "/api/admin/users", createLibrarianPayload, adminToken);
        assertEquals(201, created.statusCode());

        HttpResponse<String> duplicate = send("POST", "/api/admin/users", createLibrarianPayload, adminToken);
        assertEquals(409, duplicate.statusCode());

        HttpResponse<String> malformed = send("POST", "/api/admin/users", "{bad", adminToken);
        assertEquals(400, malformed.statusCode());
        assertEquals(
            "Malformed JSON request or invalid field value",
            objectMapper.readTree(malformed.body()).get("detail").asString()
        );

        HttpResponse<String> forbidden = send("POST", "/api/admin/users", createLibrarianPayload, librarianToken);
        assertEquals(403, forbidden.statusCode());

        // Verify GET /api/admin/users retrieves the created account list
        HttpResponse<String> listAsAdmin = send("GET", "/api/admin/users", null, adminToken);
        assertEquals(200, listAsAdmin.statusCode());
        JsonNode usersList = objectMapper.readTree(listAsAdmin.body());
        assertTrue(usersList.isArray());
        assertTrue(usersList.size() >= 3);

        HttpResponse<String> listAsLibrarian = send("GET", "/api/admin/users", null, librarianToken);
        assertEquals(403, listAsLibrarian.statusCode());
    }

    @Test
    void roleBasedAccessAndErrorDispatchBehavior() throws Exception {
        String adminToken = loginAndGetToken(TEST_ADMIN_EMAIL);
        String librarianToken = loginAndGetToken(TEST_LIBRARIAN_EMAIL);
        String memberToken = loginAndGetToken(TEST_MEMBER_EMAIL);

        assertEquals(200, send("GET", "/api/members", null, librarianToken).statusCode());
        assertEquals(403, send("GET", "/api/members", null, memberToken).statusCode());
        assertEquals(200, send("GET", "/api/me/bookshelf", null, memberToken).statusCode());
        assertEquals(401, send("GET", "/api/me/bookshelf", null, null).statusCode());
        assertEquals(403, send("GET", "/api/holds/active", null, memberToken).statusCode());
        assertEquals(200, send("GET", "/api/holds/active", null, librarianToken).statusCode());
        assertEquals(405, send("GET", "/api/loans", null, adminToken).statusCode());
        assertEquals(403, send("GET", "/error", null, adminToken).statusCode());
    }

    @Test
    void selfRegistrationPasswordChangeAdminLifecycleAndMemberLifecycle() throws Exception {
        String adminToken = loginAndGetToken(TEST_ADMIN_EMAIL);

        // 1. Public self-registration creates MEMBER account & returns JWT
        HttpResponse<String> registerRes = send(
            "POST",
            "/api/auth/register",
            """
            {"fullName":"Self Patron","email":"%s","password":"SelfStrongPass123!"}
            """.formatted(TEST_CREATED_EMAIL),
            null
        );
        assertEquals(201, registerRes.statusCode());
        String selfToken = objectMapper.readTree(registerRes.body()).get("accessToken").asString();
        assertFalse(selfToken.isBlank());

        // Self can read My Bookshelf and Notifications
        HttpResponse<String> shelfRes = send("GET", "/api/me/bookshelf", null, selfToken);
        assertEquals(200, shelfRes.statusCode());
        long memberId = objectMapper.readTree(shelfRes.body()).get("memberId").asLong();
        assertEquals(200, send("GET", "/api/me/notifications", null, selfToken).statusCode());

        // 2. Self change-password works
        HttpResponse<String> changePassRes = send(
            "POST",
            "/api/auth/change-password",
            """
            {"currentPassword":"SelfStrongPass123!","newPassword":"UpdatedStrongPass456!"}
            """,
            selfToken
        );
        assertEquals(204, changePassRes.statusCode());

        // 3. Admin toggles account disabled -> login rejected, then re-enabled + role promoted to LIBRARIAN
        JsonNode users = objectMapper.readTree(send("GET", "/api/admin/users", null, adminToken).body());
        long createdUserId = -1;
        for (JsonNode u : users) {
            if (TEST_CREATED_EMAIL.equals(u.get("email").asString())) {
                createdUserId = u.get("id").asLong();
                break;
            }
        }
        assertTrue(createdUserId > 0);

        assertEquals(
            200,
            send("PATCH", "/api/admin/users/" + createdUserId + "/status", "{\"enabled\":false}", adminToken)
                .statusCode()
        );
        assertEquals(
            401,
            send(
                "POST",
                "/api/auth/login",
                "{\"email\":\"" + TEST_CREATED_EMAIL + "\",\"password\":\"UpdatedStrongPass456!\"}",
                null
            ).statusCode()
        );
        assertEquals(
            200,
            send("PATCH", "/api/admin/users/" + createdUserId + "/status", "{\"enabled\":true}", adminToken)
                .statusCode()
        );
        assertEquals(
            200,
            send("PATCH", "/api/admin/users/" + createdUserId + "/role", "{\"role\":\"LIBRARIAN\"}", adminToken)
                .statusCode()
        );
        assertEquals(
            204,
            send("POST", "/api/admin/users/" + createdUserId + "/reset-password", "{\"newPassword\":\"AdminResetPass789!\"}", adminToken)
                .statusCode()
        );

        // 4. Member detail, edit, deactivate, and delete
        assertEquals(200, send("GET", "/api/members/" + memberId, null, adminToken).statusCode());
        assertEquals(
            200,
            send(
                "PUT",
                "/api/members/" + memberId,
                "{\"fullName\":\"Updated Patron\",\"email\":\"" + TEST_CREATED_EMAIL + "\",\"phone\":\"+855-12-345\",\"notes\":\"VIP\"}",
                adminToken
            ).statusCode()
        );
        assertEquals(
            200,
            send("PATCH", "/api/members/" + memberId + "/status", "{\"active\":false}", adminToken)
                .statusCode()
        );
        assertEquals(409, send("DELETE", "/api/members/" + memberId, null, adminToken).statusCode());

        // 5. Previously issued member token was revoked by password/status/role changes
        assertEquals(401, send("POST", "/api/admin/jobs/run-reminders", null, selfToken).statusCode());
        assertEquals(200, send("POST", "/api/admin/jobs/run-reminders", null, adminToken).statusCode());
    }
}
