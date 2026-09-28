package com.crm.repository;

import com.crm.model.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    java.util.Optional<Project> findByName(String name);
    @Query("SELECT p FROM Project p WHERE " +
           "(:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
           "(:status IS NULL OR p.status = :status)")
    Page<Project> searchProjects(@Param("search") String search,
                                 @Param("status") String status,
                                 Pageable pageable);

    List<Project> findByStatus(String status);
    long countByStatus(String status);

    @Query("SELECT DISTINCT l.project FROM Lead l WHERE l.id IN " +
           "(SELECT a.lead.id FROM LeadAssignment a WHERE a.user.id = :userId AND a.isActive = true) " +
           "AND l.project.status = 'ACTIVE'")
    List<Project> findActiveProjectsAssignedToUser(@Param("userId") Long userId);
}
