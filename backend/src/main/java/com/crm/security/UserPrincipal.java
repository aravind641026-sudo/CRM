package com.crm.security;

import com.crm.model.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String name;
    private final String email;
    @JsonIgnore
    private final String password;
    private final String role;
    private final String status;
    private final String shift;
    private final String shiftDisplayName;
    private final String shiftStartTime;
    private final String shiftEndTime;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(Long id, String name, String email, String password, String role, String status,
                         String shift, String shiftDisplayName, String shiftStartTime, String shiftEndTime,
                         Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.role = role;
        this.status = status;
        this.shift = shift;
        this.shiftDisplayName = shiftDisplayName;
        this.shiftStartTime = shiftStartTime;
        this.shiftEndTime = shiftEndTime;
        this.authorities = authorities;
    }

    public static UserPrincipal create(User user) {
        String roleName = user.getRole().getName();
        if (!roleName.startsWith("ROLE_")) {
            roleName = "ROLE_" + roleName;
        }
        GrantedAuthority authority = new SimpleGrantedAuthority(roleName);

        String shiftCode = user.getShift() != null ? user.getShift().name() : null;
        String shiftDisplay = user.getShift() != null ? user.getShift().getDisplayName() : null;
        String shiftStart = user.getShift() != null ? user.getShift().getStartTime().toString() : null;
        String shiftEnd = user.getShift() != null ? user.getShift().getEndTime().toString() : null;

        return new UserPrincipal(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getPassword(),
                user.getRole().getName(),
                user.getStatus(),
                shiftCode,
                shiftDisplay,
                shiftStart,
                shiftEnd,
                Collections.singletonList(authority)
        );
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getRole() {
        return role;
    }

    public String getStatus() {
        return status;
    }

    public String getShift() {
        return shift;
    }

    public String getShiftDisplayName() {
        return shiftDisplayName;
    }

    public String getShiftStartTime() {
        return shiftStartTime;
    }

    public String getShiftEndTime() {
        return shiftEndTime;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !"INACTIVE".equalsIgnoreCase(status) && !"REJECTED".equalsIgnoreCase(status);
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return "ACTIVE".equalsIgnoreCase(status) || "APPROVED".equalsIgnoreCase(status);
    }

    public boolean isAdmin() {
        return "ROLE_ADMIN".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role);
    }
}
