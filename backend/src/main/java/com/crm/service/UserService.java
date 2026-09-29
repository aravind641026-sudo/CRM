package com.crm.service;

import com.crm.dto.request.ChangePasswordRequest;
import com.crm.dto.request.UserCreateRequest;
import com.crm.dto.request.UserStatusRequest;
import com.crm.dto.request.UserUpdateRequest;
import com.crm.dto.response.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface UserService {
    UserResponse createUser(UserCreateRequest request, Long currentUserId);
    UserResponse registerUser(com.crm.dto.request.UserSignupRequest request);
    UserResponse updateUser(Long id, UserUpdateRequest request, Long currentUserId);
    UserResponse toggleUserStatus(Long id, UserStatusRequest request, Long currentUserId);
    UserResponse approveSignup(Long userId, Long adminUserId);
    UserResponse rejectSignup(Long userId, Long adminUserId);
    String getSignupStatus(String email);
    UserResponse getUserById(Long id);
    UserResponse getUserByEmail(String email);
    Page<UserResponse> searchUsers(String search, String role, String status, Pageable pageable);
    Page<UserResponse> getPendingSignups(Pageable pageable);
    List<UserResponse> getActiveUsers();
    void changePassword(Long userId, ChangePasswordRequest request);
    String deleteUser(Long id, Long currentUserId);
}
