package com.library.management;

import com.library.management.model.*;
import com.library.management.repository.NotificationRepository;
import com.library.management.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.concurrent.*;
import java.util.ArrayList;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class NotificationIntegrationTest extends PostgresIntegrationTest {
    @Autowired NotificationService service;
    @Autowired NotificationRepository repository;
    @Autowired TransactionTemplate transactions;

    private Loan loan(String email, String title) {
        Loan loan = new Loan(new Book(title, "Author", 2020), new Member("Reader", email),
            LocalDate.now().minusDays(14), LocalDate.now().plusDays(1));
        ReflectionTestUtils.setField(loan, "id", 991L);
        return loan;
    }

    @Test
    void concurrentReminderRequestsPersistExactlyOneNotification() throws Exception {
        Loan loan = loan("concurrent-notification@example.com", "📚".repeat(255));
        int workers = 8;
        CyclicBarrier barrier = new CyclicBarrier(workers);
        try (ExecutorService executor = Executors.newFixedThreadPool(workers)) {
            var results = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < workers; i++) {
                results.add(executor.submit(() -> {
                    barrier.await(10, TimeUnit.SECONDS);
                    return service.notifyDueSoon(loan);
                }));
            }
            int inserted = 0;
            for (Future<Boolean> result : results) if (result.get(20, TimeUnit.SECONDS)) inserted++;
            assertEquals(1, inserted);
        }
        var items = repository.findTop30ByRecipientEmailIgnoreCaseOrderByCreatedAtDescIdDesc(loan.getMember().getEmail());
        assertEquals(1, items.size());
        String title = items.getFirst().getTitle();
        assertEquals(160, title.codePointCount(0, title.length()));
        assertTrue(title.endsWith("…"));
        assertFalse(title.contains("�"));
    }

    @Test
    void longFineMessageFitsSchemaAndRollsBackWithCirculationTransaction() {
        Loan loan = loan("rollback-notification@example.com", "📚".repeat(600));
        loan.assessFine(new BigDecimal("12.00"));
        transactions.executeWithoutResult(status -> {
            service.notifyFineAssessed(loan);
            assertEquals(1, repository.countByRecipientEmailIgnoreCaseAndReadAtIsNull(loan.getMember().getEmail()));
            status.setRollbackOnly();
        });
        assertEquals(0, repository.countByRecipientEmailIgnoreCaseAndReadAtIsNull(loan.getMember().getEmail()));
        service.notifyFineAssessed(loan);
        String message = repository.findTop30ByRecipientEmailIgnoreCaseOrderByCreatedAtDescIdDesc(loan.getMember().getEmail()).getFirst().getMessage();
        assertEquals(500, message.codePointCount(0, message.length()));
        assertTrue(message.endsWith("…"));
    }
}
