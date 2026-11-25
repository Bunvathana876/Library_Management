package com.library.management.controller;

import com.library.management.dto.ScheduledJobRunResponse;
import com.library.management.service.LibraryScheduledJobs;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/jobs")
public class AdminJobsController {

    private final LibraryScheduledJobs scheduledJobs;

    public AdminJobsController(LibraryScheduledJobs scheduledJobs) {
        this.scheduledJobs = scheduledJobs;
    }

    @PostMapping("/run-reminders")
    public ScheduledJobRunResponse runReminders() {
        return scheduledJobs.runAllMaintenanceJobs();
    }
}
