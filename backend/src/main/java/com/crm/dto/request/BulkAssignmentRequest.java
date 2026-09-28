package com.crm.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkAssignmentRequest {
    @NotEmpty(message = "Lead IDs are required for bulk assignment")
    private List<Long> leadIds;

    @NotNull(message = "User ID is required for assignment")
    private Long userId;
}
