package com.crm.controller;

import com.crm.dto.request.ChangePasswordRequest;
import com.crm.dto.request.LoginRequest;
import com.crm.dto.response.ApiResponse;
import com.crm.dto.response.JwtAuthResponse;
import com.crm.dto.response.UserResponse;
import com.crm.security.CurrentUser;
import com.crm.security.JwtTokenProvider;
import com.crm.security.UserPrincipal;
import com.crm.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final UserService userService;
    private final com.crm.repository.UserRepository userRepository;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<UserResponse>> signupUser(@Valid @RequestBody com.crm.dto.request.UserSignupRequest signupRequest) {
        UserResponse response = userService.registerUser(signupRequest);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(ApiResponse.ok("Your signup request has been submitted successfully. Please wait for admin approval.", response));
    }

    @GetMapping("/signup-status")
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> checkSignupStatus(@RequestParam String email) {
        String status = userService.getSignupStatus(email);
        String message;
        switch (status.toUpperCase()) {
            case "PENDING":
                message = "Your account is waiting for admin approval.";
                break;
            case "ACTIVE":
            case "APPROVED":
                message = "Your account has been approved. You can now login.";
                break;
            case "REJECTED":
                message = "Your signup request was rejected. Please contact the administrator.";
                break;
            case "INACTIVE":
                message = "Your account is inactive. Please contact the administrator.";
                break;
            default:
                message = "No account found with this email.";
                break;
        }
        java.util.Map<String, String> result = java.util.Map.of("email", email, "status", status, "message", message);
        return ResponseEntity.ok(ApiResponse.ok(message, result));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<JwtAuthResponse>> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        String cleanEmail = loginRequest.getEmail().toLowerCase().trim();
        com.crm.model.User user = userRepository.findByEmail(cleanEmail).orElse(null);
        if (user != null) {
            if ("PENDING".equalsIgnoreCase(user.getStatus())) {
                throw new com.crm.exception.BusinessException("Your account is waiting for admin approval.");
            }
            if ("REJECTED".equalsIgnoreCase(user.getStatus())) {
                throw new com.crm.exception.BusinessException("Your signup request was rejected. Please contact the administrator.");
            }
            if ("INACTIVE".equalsIgnoreCase(user.getStatus())) {
                throw new com.crm.exception.BusinessException("Your account is inactive. Please contact the administrator.");
            }
        }

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        cleanEmail,
                        loginRequest.getPassword()
                )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();

        String jwt = tokenProvider.generateToken(authentication);

        JwtAuthResponse authResponse = JwtAuthResponse.builder()
                .token(jwt)
                .type("Bearer")
                .id(userPrincipal.getId())
                .name(userPrincipal.getName())
                .email(userPrincipal.getEmail())
                .role(userPrincipal.getRole())
                .status(userPrincipal.getStatus())
                .shift(userPrincipal.getShift())
                .shiftDisplayName(userPrincipal.getShiftDisplayName())
                .shiftStartTime(userPrincipal.getShiftStartTime())
                .shiftEndTime(userPrincipal.getShiftEndTime())
                .build();

        return ResponseEntity.ok(ApiResponse.ok("Login successful", authResponse));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(@CurrentUser UserPrincipal principal) {
        UserResponse response = userService.getUserById(principal.getId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<String>> changePassword(@CurrentUser UserPrincipal principal,
                                                             @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Password updated successfully", null));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(@CurrentUser UserPrincipal principal,
                                                                   @Valid @RequestBody com.crm.dto.request.UserUpdateRequest request) {
        UserResponse current = userService.getUserById(principal.getId());
        request.setRole(current.getRole());
        request.setStatus(current.getStatus());
        UserResponse response = userService.updateUser(principal.getId(), request, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Profile updated successfully", response));
    }
}
