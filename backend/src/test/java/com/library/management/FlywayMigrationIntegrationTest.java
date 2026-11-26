package com.library.management;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class FlywayMigrationIntegrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
    DriverManagerDataSource database() {
        var ds=new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
        String schema="fixture_"+UUID.randomUUID().toString().replace("-", "");
        new JdbcTemplate(ds).execute("CREATE SCHEMA " + schema);
        return new DriverManagerDataSource(postgres.getJdbcUrl()+"&currentSchema="+schema,postgres.getUsername(),postgres.getPassword());
    }
    Flyway migrate(DriverManagerDataSource ds, String target) {
        Flyway flyway=Flyway.configure().dataSource(ds).target(target).load(); flyway.migrate(); return flyway;
    }
    @Test void freshInstallValidatesChecksumsAndIsRestartSafe() {
        var ds=database(); var flyway=migrate(ds,"latest");
        flyway.validate(); assertEquals(9,flyway.info().applied().length);
        assertEquals(0,flyway.migrate().migrationsExecuted);
    }
    @Test void populatedV6UpgradePreservesIdentityNotificationsLoansAndFines() {
        var ds=database(); migrate(ds,"6"); var sql=new JdbcTemplate(ds);
        sql.update("INSERT INTO app_users(id,email,password_hash,role) VALUES (1,'reader@example.test','hash','MEMBER')");
        sql.update("INSERT INTO members(id,full_name,email) VALUES (1,'Existing reader','Reader@Example.Test'),(2,'Offline reader','offline@example.test')");
        sql.update("INSERT INTO books(id,title,author,publication_year) VALUES (1,'History','Author',2020)");
        sql.update("INSERT INTO book_copies(id,book_id,barcode,status) VALUES (1,1,'EXISTING','AVAILABLE')");
        sql.update("INSERT INTO loans(id,book_id,member_id,copy_id,borrowed_on,due_on,returned_on,fine_amount,fine_status) VALUES (1,1,1,1,'2026-01-01','2026-01-15','2026-01-20',2.50,'PAID')");
        sql.update("INSERT INTO notifications(id,recipient_email,type,title,message,reference_key,read_at) VALUES (1,'reader@example.test','ACCOUNT','History','Preserve me','history',CURRENT_TIMESTAMP),(2,'unlinked@example.test','ACCOUNT','Offline','Keep too','offline',NULL)");
        var flyway=migrate(ds,"latest"); flyway.validate();
        assertEquals(2,sql.queryForObject("SELECT count(*) FROM members",Integer.class));
        assertEquals(1L,sql.queryForObject("SELECT app_user_id FROM members WHERE id=1",Long.class));
        assertNull(sql.queryForObject("SELECT app_user_id FROM members WHERE id=2",Long.class));
        assertEquals(1L,sql.queryForObject("SELECT recipient_member_id FROM notifications WHERE id=1",Long.class));
        assertEquals(2,sql.queryForObject("SELECT count(*) FROM notifications",Integer.class));
        assertEquals("Preserve me",sql.queryForObject("SELECT message FROM notifications WHERE id=1",String.class));
        assertEquals(1,sql.queryForObject("SELECT count(*) FROM notifications WHERE read_at IS NOT NULL",Integer.class));
        assertEquals("PAID",sql.queryForObject("SELECT fine_status FROM loans WHERE id=1",String.class));
        assertEquals(new java.math.BigDecimal("2.50"),sql.queryForObject("SELECT fine_amount FROM loans WHERE id=1",java.math.BigDecimal.class));
        assertEquals(1,sql.queryForObject("SELECT count(*) FROM loans l JOIN members m ON m.id=l.member_id JOIN book_copies c ON c.id=l.copy_id WHERE returned_on='2026-01-20'",Integer.class));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> sql.update("UPDATE members SET app_user_id=999 WHERE id=2"));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> sql.update("UPDATE members SET app_user_id=1 WHERE id=2"));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> sql.update("UPDATE notifications SET recipient_member_id=999 WHERE id=2"));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> sql.update("INSERT INTO members(full_name,email) VALUES ('Duplicate',' reader@example.test ' )"));
        assertEquals(0,flyway.migrate().migrationsExecuted);
    }
    @Test void ambiguousV6IdentitiesFailWithoutDeletingRecords() {
        var ds=database(); migrate(ds,"6"); var sql=new JdbcTemplate(ds);
        sql.update("INSERT INTO members(full_name,email) VALUES ('One','reader@example.test'),('Two','Reader@Example.Test')");
        assertThrows(org.flywaydb.core.api.FlywayException.class, () -> migrate(ds,"latest"));
        assertEquals(2,sql.queryForObject("SELECT count(*) FROM members",Integer.class));
        assertEquals(0,sql.queryForObject("SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='members' AND column_name='app_user_id'",Integer.class));
    }
}
