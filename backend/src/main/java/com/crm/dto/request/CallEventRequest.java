package com.crm.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallEventRequest {

    /**
     * Lifecycle event: CALL_INITIATED, CALL_RINGING, CALL_CONNECTED, CALL_ENDED, CALL_MISSED, CALL_REJECTED, CALL_FAILED, CALL_CANCELLED
     */
    @NotBlank(message = "Event type is required")
    private String eventType;

    /**
     * Unique telephony call identifier or client session UUID for idempotency
     */
    private String telephonyCallId;

    /**
     * Optional event sequence id for idempotency
     */
    private String eventId;

    private Long leadId;
    private String customerPhone;
    private Long projectId;

    @Builder.Default
    private String callDirection = "OUTBOUND"; // OUTBOUND, INBOUND

    private LocalDateTime timestamp;
    private Integer durationSeconds;
    private Boolean isConnected;

    /**
     * Technical call result: CONNECTED, MISSED, REJECTED, FAILED, CANCELLED
     */
    private String technicalStatus;

    /**
     * Business classification suggestion or confirmed status:
     * VERY_SHORT, SHORT_CALL, INTERESTED, FOLLOW_UP, NOT_INTERESTED, JUNK, SALE, OTHER
     */
    private String businessClassification;

    private String notes;

    private Boolean followUpRequired;
    private LocalDateTime followUpDate;
    private String followUpNotes;
}
