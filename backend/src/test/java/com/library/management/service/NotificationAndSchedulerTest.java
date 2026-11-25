package com.library.management.service;

import com.library.management.config.CirculationPolicyProperties;
import com.library.management.dto.NotificationListResponse;
import com.library.management.dto.ScheduledJobRunResponse;
import com.library.management.model.Book;
import com.library.management.model.Loan;
import com.library.management.model.Member;
import com.library.management.model.Notification;
import com.library.management.model.NotificationType;
import com.library.management.repository.LoanRepository;
import com.library.management.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationAndSchedulerTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private HoldService holdService;

    @Mock
    private LoanRepository loanRepository;

    @Mock
    private LoanService loanService;

    @Test
    void shouldDeduplicateAndSendOptionalEmailWhenEnabled() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        NotificationService service = new NotificationService(
            notificationRepository,
            mailSenderProvider,
            true,
            "no-reply@athenaeum.local"
        );

        Book book = new Book("DDIA", "Martin Kleppmann", 2017);
        Member member = new Member("Alice", "alice@example.com");
        Loan loan = new Loan(book, member, LocalDate.now().minusDays(12), LocalDate.now().plusDays(1));
        ReflectionTestUtils.setField(loan, "id", 10L);

        when(notificationRepository.existsByRecipientEmailIgnoreCaseAndReferenceKey(eq("alice@example.com"), any()))
            .thenReturn(false)
            .thenReturn(true);

        assertTrue(service.notifyDueSoon(loan));
        assertFalse(service.notifyDueSoon(loan));

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    void shouldMarkSingleAndAllNotificationsAsRead() {
        NotificationService service = new NotificationService(
            notificationRepository,
            mailSenderProvider,
            false,
            "no-reply@athenaeum.local"
        );

        Notification item = new Notification(
            "alice@example.com",
            NotificationType.HOLD_READY,
            "Hold ready",
            "Ready at desk",
            "HOLD_READY:1:2026-11-28"
        );
        ReflectionTestUtils.setField(item, "id", 7L);

        when(notificationRepository.countByRecipientEmailIgnoreCaseAndReadAtIsNull("alice@example.com"))
            .thenReturn(1L);
        when(notificationRepository.findTop30ByRecipientEmailIgnoreCaseOrderByCreatedAtDescIdDesc("alice@example.com"))
            .thenReturn(List.of(item));
        when(notificationRepository.findByIdAndRecipientEmailIgnoreCase(7L, "alice@example.com"))
            .thenReturn(Optional.of(item));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
        when(notificationRepository.markAllReadForRecipient(eq("alice@example.com"), any())).thenReturn(1);

        NotificationListResponse list = service.getForUser("Alice@example.com ");
        assertEquals(1L, list.unreadCount());
        assertEquals(1, list.items().size());

        assertNotNull(service.markAsRead(7L, "alice@example.com").readAt());
        assertEquals(1, service.markAllAsRead("alice@example.com"));
    }

    @Test
    void scheduledJobsShouldExpireHoldsAndGenerateDueSoonAndOverdueNotifications() {
        CirculationPolicyProperties policy = CirculationPolicyProperties.defaults();
        NotificationService notificationService = mock(NotificationService.class);
        LibraryScheduledJobs jobs = new LibraryScheduledJobs(
            holdService,
            loanRepository,
            loanService,
            policy,
            notificationService
        );

        Book book = new Book("Clean Code", "Robert C. Martin", 2008);
        Member member = new Member("Bob", "bob@example.com");
        Loan dueSoon = new Loan(book, member, LocalDate.now().minusDays(13), LocalDate.now().plusDays(1));
        ReflectionTestUtils.setField(dueSoon, "id", 1L);
        Loan overdue = new Loan(book, member, LocalDate.now().minusDays(18), LocalDate.now().minusDays(4));
        ReflectionTestUtils.setField(overdue, "id", 2L);

        when(holdService.expireStaleReadyHolds()).thenReturn(2);
        when(loanRepository.findAllByReturnedOnIsNullAndDueOnBetweenOrderByDueOnAsc(any(), any()))
            .thenReturn(List.of(dueSoon));
        when(loanRepository.findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(any()))
            .thenReturn(List.of(overdue));
        when(loanService.calculateAccruedFine(eq(overdue), any())).thenReturn(new BigDecimal("2.00"));
        when(notificationService.notifyDueSoon(dueSoon)).thenReturn(true);
        when(notificationService.notifyOverdue(eq(overdue), eq(new BigDecimal("2.00")), any())).thenReturn(true);

        ScheduledJobRunResponse result = jobs.runAllMaintenanceJobs();
        assertEquals(2, result.expiredHolds());
        assertEquals(1, result.dueSoonNotifications());
        assertEquals(1, result.overdueNotifications());
    }
}
