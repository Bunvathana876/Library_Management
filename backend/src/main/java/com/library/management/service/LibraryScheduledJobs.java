package com.library.management.service;

import com.library.management.config.CirculationPolicyProperties;
import com.library.management.dto.ScheduledJobRunResponse;
import com.library.management.model.Loan;
import com.library.management.repository.LoanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Component
public class LibraryScheduledJobs {

    private static final Logger log = LoggerFactory.getLogger(LibraryScheduledJobs.class);

    private final HoldService holdService;
    private final LoanRepository loanRepository;
    private final LoanService loanService;
    private final CirculationPolicyProperties policy;
    private final NotificationService notificationService;

    public LibraryScheduledJobs(
            HoldService holdService,
            LoanRepository loanRepository,
            LoanService loanService,
            CirculationPolicyProperties policy,
            NotificationService notificationService
    ) {
        this.holdService = holdService;
        this.loanRepository = loanRepository;
        this.loanService = loanService;
        this.policy = policy;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "${app.scheduling.hold-expiry-cron:0 0 2 * * *}")
    @Transactional
    public int runHoldExpirationJob() {
        int expired = holdService.expireStaleReadyHolds();
        if (expired > 0) {
            log.info("Nightly hold expiration job expired {} ready holds", expired);
        }
        return expired;
    }

    @Scheduled(cron = "${app.scheduling.due-reminders-cron:0 0 8 * * *}")
    @Transactional
    public ScheduledJobRunResponse runDueAndOverdueReminderJob() {
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(policy.getDueSoonDays());

        int dueSoonSent = 0;
        List<Loan> dueSoonLoans = loanRepository.findAllByReturnedOnIsNullAndDueOnBetweenOrderByDueOnAsc(today, horizon);
        for (Loan loan : dueSoonLoans) {
            if (notificationService.notifyDueSoon(loan)) {
                dueSoonSent++;
            }
        }

        int overdueSent = 0;
        List<Loan> overdueLoans = loanRepository.findAllByReturnedOnIsNullAndDueOnBeforeOrderByDueOnAsc(today);
        for (Loan loan : overdueLoans) {
            BigDecimal accrued = loanService.calculateAccruedFine(loan, today);
            if (notificationService.notifyOverdue(loan, accrued, today)) {
                overdueSent++;
            }
        }

        if (dueSoonSent > 0 || overdueSent > 0) {
            log.info("Reminder job created {} due-soon and {} overdue notifications", dueSoonSent, overdueSent);
        }

        return new ScheduledJobRunResponse(0, dueSoonSent, overdueSent);
    }

    @Transactional
    public ScheduledJobRunResponse runAllMaintenanceJobs() {
        int expired = holdService.expireStaleReadyHolds();
        ScheduledJobRunResponse reminders = runDueAndOverdueReminderJob();
        return new ScheduledJobRunResponse(
            expired,
            reminders.dueSoonNotifications(),
            reminders.overdueNotifications()
        );
    }
}
