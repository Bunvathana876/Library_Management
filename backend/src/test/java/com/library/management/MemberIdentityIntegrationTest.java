package com.library.management;

import com.library.management.model.*;
import com.library.management.repository.*;
import com.library.management.service.MemberService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.concurrent.*;
import java.util.ArrayList;
import java.util.HashSet;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class MemberIdentityIntegrationTest extends PostgresIntegrationTest {
    @Autowired AppUserRepository users;
    @Autowired MemberRepository members;
    @Autowired MemberService service;
    @Autowired NotificationRepository notifications;
    @Autowired com.library.management.service.NotificationService notificationService;
    @Autowired org.springframework.transaction.support.TransactionTemplate transactions;

    @Test
    void concurrentProfileRequestsUseOneStableMember() throws Exception {
        var user = users.save(new AppUser("parallel@identity.test", "unused", UserRole.MEMBER));
        CyclicBarrier barrier = new CyclicBarrier(4);
        try (ExecutorService pool = Executors.newFixedThreadPool(4)) {
            var futures = new ArrayList<Future<Long>>();
            for (int i = 0; i < 4; i++) futures.add(pool.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return service.ensureMemberForEmail(user.getEmail(), "Reader").getId();
            }));
            var ids = new HashSet<Long>();
            for (var future : futures) ids.add(future.get(20, TimeUnit.SECONDS));
            assertEquals(1, ids.size());
            assertEquals(ids.iterator().next(), members.findByAccountId(user.getId()).orElseThrow().getId());
        }
    }

    @Test
    void existingOfflineMemberIsLinkedWithoutReplacement() {
        Member original = members.save(new Member("Offline reader", "offline@identity.test"));
        assertNull(original.getAccount());
        var user = users.save(new AppUser(original.getEmail(), "unused", UserRole.MEMBER));
        Member linked = service.ensureMemberForEmail(user.getEmail(), "New name");
        assertEquals(original.getId(), linked.getId());
        assertEquals("Offline reader", linked.getFullName());
        assertEquals(original.getId(), members.findByAccountId(user.getId()).orElseThrow().getId());
    }

    @Test
    void emailChangeKeepsIdentityAndNotificationsAndRejectsAccountConflicts() {
        var user = users.save(new AppUser("email-before@identity.test", "unused", UserRole.MEMBER));
        Member member = service.ensureMemberForEmail(user.getEmail(), "Reader");
        transactions.executeWithoutResult(status -> notifications.insertIfAbsent(user.getEmail(), "ACCOUNT", "Original notice", "Keep this history", "identity-history"));
        String previousVersion = user.getTokenVersion();
        service.updateMember(member.getId(), new com.library.management.dto.UpdateMemberRequest(
            "Reader", "email-after@identity.test", null, null));
        var changed = users.findById(user.getId()).orElseThrow();
        assertEquals("email-after@identity.test", changed.getEmail());
        assertNotEquals(previousVersion, changed.getTokenVersion());
        assertEquals(member.getId(), service.ensureMemberForEmail(changed.getEmail(), null).getId());
        var inbox = notificationService.getForUser(changed.getEmail());
        assertEquals(1, inbox.items().size());
        assertEquals(0, notificationService.getForUser("email-before@identity.test").items().size());
        notificationService.markAsRead(inbox.items().getFirst().id(), changed.getEmail());
        assertEquals(0, notificationService.getForUser(changed.getEmail()).unreadCount());
        users.save(new AppUser("occupied@identity.test", "unused", UserRole.MEMBER));
        assertThrows(com.library.management.exception.BusinessRuleException.class, () ->
            service.updateMember(member.getId(), new com.library.management.dto.UpdateMemberRequest(
                "Reader", "occupied@identity.test", null, null)));
        assertEquals(changed.getEmail(), members.findById(member.getId()).orElseThrow().getEmail());
        assertEquals(changed.getEmail(), users.findById(user.getId()).orElseThrow().getEmail());
    }
}
