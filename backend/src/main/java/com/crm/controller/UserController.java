package com.crm.controller;

import com.crm.dto.request.UserCreateRequest;
import com.crm.dto.request.UserStatusRequest;
import com.crm.dto.request.UserUpdateRequest;
import com.crm.dto.response.ApiResponse;
import com.crm.dto.response.PageResponse;
import com.crm.dto.response.UserResponse;
import com.crm.security.CurrentUser;
import com.crm.security.UserPrincipal;
import com.crm.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService userService;
    private final com.crm.repository.UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<UserResponse>>> searchUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Page<UserResponse> result = userService.searchUsers(search, role, status, PageRequest.of(page, size, sort));

        return ResponseEntity.ok(ApiResponse.ok(PageResponse.from(result)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody UserCreateRequest request,
                                                               @CurrentUser UserPrincipal principal) {
        UserResponse response = userService.createUser(request, principal.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("User created successfully", response));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getActiveUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getActiveUsers()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUserById(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(@PathVariable Long id,
                                                               @Valid @RequestBody UserUpdateRequest request,
                                                               @CurrentUser UserPrincipal principal) {
        UserResponse response = userService.updateUser(id, request, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("User updated successfully", response));
    }

    @PatchMapping({ "/{id}/status", "/{id}/toggle-status" })
    public ResponseEntity<ApiResponse<UserResponse>> toggleUserStatus(@PathVariable Long id,
                                                                      @RequestBody(required = false) UserStatusRequest request,
                                                                      @CurrentUser UserPrincipal principal) {
        UserResponse response = userService.toggleUserStatus(id, request, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("User status updated successfully", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> deleteUser(@PathVariable Long id,
                                                         @CurrentUser UserPrincipal principal) {
        String msg = userService.deleteUser(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok(msg, msg));
    }
}
