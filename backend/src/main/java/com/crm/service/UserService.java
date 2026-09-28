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
    UserResponse updateUser(Long id, UserUpdateRequest request, Long currentUserId);
    UserResponse toggleUserStatus(Long id, UserStatusRequest request, Long currentUserId);
    UserResponse getUserById(Long id);
    UserResponse getUserByEmail(String email);
    Page<UserResponse> searchUsers(String search, String role, String status, Pageable pageable);
    List<UserResponse> getActiveUsers();
    void changePassword(Long userId, ChangePasswordRequest request);
    String deleteUser(Long id, Long currentUserId);
}
