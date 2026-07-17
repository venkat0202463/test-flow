package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.model.Product;
import com.scaloz.superadmin.model.ProductModule;
import com.scaloz.superadmin.model.TenantModule;
import com.scaloz.superadmin.model.Tenant;
import com.scaloz.superadmin.repository.ProductRepository;
import com.scaloz.superadmin.repository.TenantModuleRepository;
import com.scaloz.superadmin.repository.TenantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TenantAccessController {

    @Autowired
    private TenantModuleRepository tenantModuleRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TenantRepository tenantRepository;

    // 1. GET /api/tenant/{tenantId}/products
    @GetMapping("/tenant/{tenantId}/products")
    public ResponseEntity<?> getTenantProducts(@PathVariable Long tenantId) {
        Map<Long, Product> productsMap = new LinkedHashMap<>();

        // 1) Fetch products from Tenant's selectedProducts field (comma separated codes)
        Optional<Tenant> tenantOpt = tenantRepository.findById(tenantId);
        if (tenantOpt.isPresent()) {
            Tenant tenant = tenantOpt.get();
            String selectedProds = tenant.getSelectedProducts();
            if (selectedProds != null && !selectedProds.trim().isEmpty()) {
                String[] prodCodes = selectedProds.split(",");
                for (String c : prodCodes) {
                    String cleanCode = c.trim();
                    if (cleanCode.contains(":")) {
                        cleanCode = cleanCode.split(":", 2)[0].trim();
                    }
                    Optional<Product> pOpt = productRepository.findByCode(cleanCode);
                    if (pOpt.isPresent()) {
                        Product p = pOpt.get();
                        productsMap.put(p.getId(), p);
                    }
                }
            }
        }

        // 2) Fetch products from TenantModule mappings (fallback / compatibility)
        List<TenantModule> tenantModules = tenantModuleRepository.findByTenantId(tenantId);
        for (TenantModule tm : tenantModules) {
            ProductModule pm = tm.getProductModule();
            if (pm != null && pm.getProduct() != null) {
                Product p = pm.getProduct();
                if (!productsMap.containsKey(p.getId())) {
                    productsMap.put(p.getId(), p);
                }
            }
        }

        List<Map<String, Object>> response = new ArrayList<>();
        for (Product p : productsMap.values()) {
            Map<String, Object> pMap = new LinkedHashMap<>();
            pMap.put("productId", p.getId());
            pMap.put("productName", p.getName());
            pMap.put("productCode", p.getCode());
            pMap.put("url", p.getUrl());
            response.add(pMap);
        }

        return ResponseEntity.ok(response);
    }

    // 2. GET /api/tenant/{tenantId}/products/{productId}/modules
    @GetMapping("/tenant/{tenantId}/products/{productId}/modules")
    public ResponseEntity<?> getTenantProductModules(@PathVariable Long tenantId, @PathVariable Long productId) {
        List<TenantModule> tenantModules = tenantModuleRepository.findByTenantId(tenantId);
        List<Map<String, Object>> response = new ArrayList<>();

        for (TenantModule tm : tenantModules) {
            ProductModule pm = tm.getProductModule();
            if (pm != null && pm.getProduct() != null && pm.getProduct().getId().equals(productId)) {
                Map<String, Object> mMap = new HashMap<>();
                mMap.put("moduleName", pm.getName());
                mMap.put("moduleCode", pm.getCode());
                mMap.put("productCode", pm.getProductCode());
                response.add(mMap);
            }
        }

        return ResponseEntity.ok(response);
    }

    // 3. Central Access API: GET /api/access/{productCode}/{tenantId}
    @GetMapping("/access/{productCode}/{tenantId}")
    public ResponseEntity<?> getAccessInfo(@PathVariable String productCode, @PathVariable Long tenantId) {
        List<TenantModule> tenantModules = tenantModuleRepository.findByTenantId(tenantId);
        List<Map<String, Object>> allowedModules = new ArrayList<>();

        for (TenantModule tm : tenantModules) {
            ProductModule pm = tm.getProductModule();
            if (pm != null && pm.getProduct() != null && pm.getProduct().getCode().equalsIgnoreCase(productCode)) {
                Map<String, Object> mMap = new HashMap<>();
                mMap.put("code", pm.getCode());
                mMap.put("name", pm.getName());
                mMap.put("productCode", pm.getProductCode());
                allowedModules.add(mMap);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("tenantId", tenantId);
        response.put("product", productCode.toUpperCase());
        response.put("modules", allowedModules);

        return ResponseEntity.ok(response);
    }
}
