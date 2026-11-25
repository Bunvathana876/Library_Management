package com.library.management.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class CirculationPolicyProperties {

    private final int maxActiveLoans;
    private final BigDecimal dailyFineRate;
    private final BigDecimal fineBlockThreshold;
    private final int dueSoonDays;

    public CirculationPolicyProperties(
            @Value("${app.circulation.max-active-loans:5}") int maxActiveLoans,
            @Value("${app.circulation.daily-fine-rate:0.50}") BigDecimal dailyFineRate,
            @Value("${app.circulation.fine-block-threshold:10.00}") BigDecimal fineBlockThreshold,
            @Value("${app.circulation.due-soon-days:2}") int dueSoonDays
    ) {
        this.maxActiveLoans = maxActiveLoans > 0 ? maxActiveLoans : 5;
        this.dailyFineRate = dailyFineRate != null && dailyFineRate.compareTo(BigDecimal.ZERO) >= 0
            ? dailyFineRate
            : new BigDecimal("0.50");
        this.fineBlockThreshold = fineBlockThreshold != null && fineBlockThreshold.compareTo(BigDecimal.ZERO) > 0
            ? fineBlockThreshold
            : new BigDecimal("10.00");
        this.dueSoonDays = dueSoonDays >= 0 ? dueSoonDays : 2;
    }

    public static CirculationPolicyProperties defaults() {
        return new CirculationPolicyProperties(5, new BigDecimal("0.50"), new BigDecimal("10.00"), 2);
    }

    public int getMaxActiveLoans() {
        return maxActiveLoans;
    }

    public BigDecimal getDailyFineRate() {
        return dailyFineRate;
    }

    public BigDecimal getFineBlockThreshold() {
        return fineBlockThreshold;
    }

    public int getDueSoonDays() {
        return dueSoonDays;
    }
}
