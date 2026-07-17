package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.model.Tenant;
import com.scaloz.superadmin.model.Subscription;
import com.scaloz.superadmin.repository.TenantRepository;
import com.scaloz.superadmin.repository.SubscriptionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @GetMapping
    public List<Subscription> getAllSubscriptions() {
        return subscriptionRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> createOrUpdateSubscription(@RequestBody SubscriptionRequest request) {
        Optional<Tenant> optionalTenant = tenantRepository.findById(request.getTenantId());
        if (optionalTenant.isEmpty()) {
            return ResponseEntity.badRequest().body("Tenant with ID " + request.getTenantId() + " not found.");
        }

        // Check if subscription already exists for this tenant
        Optional<Subscription> existing = subscriptionRepository.findByTenantId(request.getTenantId());
        Subscription subscription = existing.orElse(new Subscription());
        
        subscription.setPlanName(request.getPlanName());
        subscription.setUserLimit(request.getUserLimit());
        subscription.setStatus(request.getStatus() != null ? request.getStatus() : "Active");
        subscription.setTenant(optionalTenant.get());

        Subscription saved = subscriptionRepository.save(subscription);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSubscription(@PathVariable Long id) {
        if (subscriptionRepository.existsById(id)) {
            subscriptionRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    public static class SubscriptionRequest {
        private String planName;
        private Integer userLimit;
        private String status;
        private Long tenantId;

        public String getPlanName() {
            return planName;
        }

        public void setPlanName(String planName) {
            this.planName = planName;
        }

        public Integer getUserLimit() {
            return userLimit;
        }

        public void setUserLimit(Integer userLimit) {
            this.userLimit = userLimit;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public Long getTenantId() {
            return tenantId;
        }

        public void setTenantId(Long tenantId) {
            this.tenantId = tenantId;
        }
    }
}
