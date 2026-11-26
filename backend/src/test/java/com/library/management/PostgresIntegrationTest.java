package com.library.management;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** All full-context tests use disposable PostgreSQL, never the development database. */
@ActiveProfiles("test")
@Import(PostgresIntegrationTest.DatabaseConfiguration.class)
@TestPropertySource(properties = {
    "spring.config.import=",
    "spring.profiles.active=test",
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/test-only-fallback",
    "spring.datasource.username=test",
    "spring.datasource.password=test",
    "app.jwt.secret-base64=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    "app.bootstrap.admin.email=",
    "app.bootstrap.admin.password=",
    "app.notifications.email.enabled=false",
    "management.health.mail.enabled=false",
    "app.scheduling.hold-expiry-cron=-",
    "app.scheduling.due-reminders-cron=-",
    "spring.jpa.show-sql=false"
})
abstract class PostgresIntegrationTest {
    @TestConfiguration(proxyBeanMethods = false)
    static class DatabaseConfiguration {
        // Spring starts this before the datasource and stops it after the context closes.
        @Bean
        @ServiceConnection
        PostgreSQLContainer postgres() {
            return new PostgreSQLContainer("postgres:17-alpine");
        }
    }
}
