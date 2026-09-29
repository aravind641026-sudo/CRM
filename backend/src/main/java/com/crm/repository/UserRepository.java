package com.crm.repository;

import com.crm.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByFirebaseUid(String firebaseUid);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE " +
           "(:search IS NULL OR :search = '' OR LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:role IS NULL OR :role = '' OR :role = 'ALL' OR u.role.name = :role) AND " +
           "(:status IS NULL OR :status = '' OR :status = 'ALL' OR u.status = :status)")
    Page<User> searchUsers(@Param("search") String search,
                           @Param("role") String role,
                           @Param("status") String status,
                           Pageable pageable);

    List<User> findByStatus(String status);
    Page<User> findByStatus(String status, Pageable pageable);
}
