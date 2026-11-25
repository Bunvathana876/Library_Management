package com.library.management.service;

import com.library.management.dto.NotificationListResponse;
import com.library.management.dto.NotificationResponse;
import com.library.management.exception.ResourceNotFoundException;
import com.library.management.model.Hold;
import com.library.management.model.Loan;
import com.library.management.model.Notification;
import com.library.management.model.NotificationType;
import com.library.management.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final boolean emailEnabled;
    private final String fromAddress;

    public NotificationService(
            NotificationRepository notificationRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.notifications.email.enabled:false}") boolean emailEnabled,
            @Value("${app.notifications.email.from:no-reply@athenaeum.local}") String fromAddress
    ) {
        this.notificationRepository = notificationRepository;
        this.mailSenderProvider = mailSenderProvider;
        this.emailEnabled = emailEnabled;
        this.fromAddress = fromAddress;
    }

    @Transactional(readOnly = true)
    public NotificationListResponse getForUser(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        long unread = notificationRepository.countByRecipientEmailIgnoreCaseAndReadAtIsNull(email);
        List<NotificationResponse> items = notificationRepository
            .findTop30ByRecipientEmailIgnoreCaseOrderByCreatedAtDescIdDesc(email)
            .stream()
            .map(NotificationResponse::from)
            .toList();
        return new NotificationListResponse(unread, items);
    }

    @Transactional
    public NotificationResponse markAsRead(Long id, String rawEmail) {
        String email = normalizeEmail(rawEmail);
        Notification notification = notificationRepository
            .findByIdAndRecipientEmailIgnoreCase(id, email)
            .orElseThrow(() -> new ResourceNotFoundException("Notification", id));
        notification.markRead(Instant.now());
        return NotificationResponse.from(notificationRepository.save(notification));
    }

    @Transactional
    public int markAllAsRead(String rawEmail) {
        return notificationRepository.markAllReadForRecipient(normalizeEmail(rawEmail), Instant.now());
    }

    @Transactional
    public void notifyHoldReady(Hold hold) {
        if (hold == null || hold.getMember() == null || hold.getBook() == null) {
            return;
        }
        String email = normalizeEmail(hold.getMember().getEmail());
        String expiryText = hold.getExpiresOn() != null ? hold.getExpiresOn().toString() : "within 3 days";
        String copySuffix = hold.getCopy() != null ? " (" + hold.getCopy().getBarcode() + ")" : "";
        String title = "Hold ready for pickup: " + hold.getBook().getTitle();
        String message = "Your reserved copy" + copySuffix + " is waiting at the circulation desk. Please pick it up by " + expiryText + ".";
        String key = "HOLD_READY:" + hold.getId() + ":" + expiryText;

        createIfAbsent(email, NotificationType.HOLD_READY, title, message, key, true);
    }

    @Transactional
    public void notifyHoldExpired(Hold hold) {
        if (hold == null || hold.getMember() == null || hold.getBook() == null) {
            return;
        }
        String email = normalizeEmail(hold.getMember().getEmail());
        String title = "Pickup hold expired: " + hold.getBook().getTitle();
        String message = "The 3-day pickup window for your reservation expired and the hold was released.";
        String key = "HOLD_EXPIRED:" + hold.getId();

        createIfAbsent(email, NotificationType.HOLD_EXPIRED, title, message, key, false);
    }

    @Transactional
    public boolean notifyDueSoon(Loan loan) {
        if (loan == null || loan.getMember() == null || loan.getBook() == null || loan.getDueOn() == null) {
            return false;
        }
        String email = normalizeEmail(loan.getMember().getEmail());
        String title = "Book due soon: " + loan.getBook().getTitle();
        String message = "Loan #" + loan.getId() + " is due on " + loan.getDueOn() + ". Renew in My Bookshelf if eligible.";
        String key = "DUE_SOON:" + loan.getId() + ":" + loan.getDueOn();

        return createIfAbsent(email, NotificationType.DUE_SOON, title, message, key, true);
    }

    @Transactional
    public boolean notifyOverdue(Loan loan, BigDecimal accruedFine, LocalDate today) {
        if (loan == null || loan.getMember() == null || loan.getBook() == null) {
            return false;
        }
        String email = normalizeEmail(loan.getMember().getEmail());
        BigDecimal formatted = (accruedFine != null ? accruedFine : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        String title = "Overdue loan reminder: " + loan.getBook().getTitle();
        String message = "Loan #" + loan.getId() + " was due on " + loan.getDueOn()
            + ". Current accrued fine: $" + formatted + ".";
        String key = "OVERDUE:" + loan.getId() + ":" + today;

        return createIfAbsent(email, NotificationType.OVERDUE, title, message, key, true);
    }

    @Transactional
    public void notifyFineAssessed(Loan loan) {
        if (loan == null || loan.getMember() == null || loan.getBook() == null
                || loan.getFineAmount() == null || loan.getFineAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        String email = normalizeEmail(loan.getMember().getEmail());
        BigDecimal formatted = loan.getFineAmount().setScale(2, RoundingMode.HALF_UP);
        String title = "Overdue fine assessed ($" + formatted + ")";
        String message = "An overdue fine of $" + formatted + " was recorded on Loan #" + loan.getId()
            + " (\"" + loan.getBook().getTitle() + "\"). Please settle at the circulation desk.";
        String key = "FINE_ASSESSED:" + loan.getId();

        createIfAbsent(email, NotificationType.FINE_ASSESSED, title, message, key, true);
    }

    private boolean createIfAbsent(
            String email,
            NotificationType type,
            String title,
            String message,
            String referenceKey,
            boolean sendEmail
    ) {
        if (email.isBlank()) {
            return false;
        }
        if (referenceKey != null
                && notificationRepository.existsByRecipientEmailIgnoreCaseAndReferenceKey(email, referenceKey)) {
            return false;
        }
        notificationRepository.save(new Notification(email, type, title, message, referenceKey));
        if (sendEmail) {
            sendEmailSafely(email, title, message);
        }
        return true;
    }

    private void sendEmailSafely(String to, String subject, String body) {
        if (!emailEnabled) {
            return;
        }
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(to);
            msg.setSubject("[Athenaeum] " + subject);
            msg.setText(body);
            sender.send(msg);
        } catch (Exception ex) {
            log.warn("Failed to send notification email to {}: {}", to, ex.getMessage());
        }
    }

    private static String normalizeEmail(String rawEmail) {
        return rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
    }
}
