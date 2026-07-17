package com.flowtrack.repository;

import com.flowtrack.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByEmail(String email);
    Optional<User> findByEmpId(String empId);
    Optional<User> findByEmailOrEmpId(String email, String empId);
    Optional<User> findByResetToken(String resetToken);
    Boolean existsByEmail(String email);
    Boolean existsByEmpId(String empId);
    // Find all users belonging to a specific tenant (for cross-tenant user visibility)
    List<User> findByTenant_Id(Long tenantDbId);
    // Find all users onboarded by a specific user (for hierarchy building)
    List<User> findByOnboardedBy(Long onboardedById);
    // Find the root system admin (ADMIN role with no parent — created by DataInitializer)
    Optional<User> findFirstByRoleAndOnboardedByIsNull(com.flowtrack.model.Role role);
    List<User> findByRole(com.flowtrack.model.Role role);
    List<User> findByRoleIn(java.util.Collection<com.flowtrack.model.Role> roles);
}
