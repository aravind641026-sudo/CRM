package com.crm.util;

public final class CallStatusCalculator {

    public static final String MISSED = "MISSED";
    public static final String JUNK = "JUNK";
    public static final String CONNECTED = "CONNECTED";
    public static final String PROSPECT = "PROSPECT";

    // Legacy fallback aliases for backward compatibility
    public static final String NOT_ATTENDED = "MISSED";
    public static final String ACCEPTANCE = "CONNECTED";

    private CallStatusCalculator() {}

    /**
     * Determines whether a technical status represents a successfully established connection.
     */
    public static boolean isConnectedResult(String technicalStatus) {
        if (technicalStatus == null) return false;
        String s = technicalStatus.trim().toUpperCase();
        return "CONNECTED".equals(s) || "ANSWERED".equals(s);
    }

    /**
     * Calculates automatic call status based strictly on connection state and actual conversation duration in seconds.
     *
     * Boundary Rules:
     * - MISSED: Call was NOT answered (regardless of ring duration) OR duration <= 0
     * - JUNK: Call was ANSWERED AND duration < 30 seconds
     * - CONNECTED: Call was ANSWERED AND duration >= 30 seconds AND duration <= 300 seconds (5 mins)
     * - PROSPECT: Call was ANSWERED AND duration > 300 seconds (> 5 mins)
     */
    public static String calculateStatus(boolean isConnected, Integer durationSeconds) {
        if (!isConnected) {
            return MISSED;
        }

        int duration = (durationSeconds != null) ? Math.max(0, durationSeconds) : 0;
        if (duration <= 0) {
            return MISSED;
        }

        if (duration < 30) {
            return JUNK;
        } else if (duration <= 300) {
            return CONNECTED;
        } else {
            return PROSPECT;
        }
    }

    /**
     * Overloaded helper using technical status string and duration.
     */
    public static String calculateStatus(String technicalStatus, Integer durationSeconds) {
        boolean connected = isConnectedResult(technicalStatus);
        return calculateStatus(connected, durationSeconds);
    }

    /**
     * Returns user-facing display label.
     */
    public static String getDisplayLabel(String status) {
        if (status == null) return "Unknown";
        return switch (status.trim().toUpperCase()) {
            case MISSED, "NOT_ATTENDED", "NO_ANSWER", "REJECTED", "FAILED", "CANCELLED" -> "Missed";
            case JUNK -> "Junk";
            case CONNECTED, "ACCEPTANCE" -> "Connected";
            case PROSPECT -> "Prospect";
            default -> status;
        };
    }
}
