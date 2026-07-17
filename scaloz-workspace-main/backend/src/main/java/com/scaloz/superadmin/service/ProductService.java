package com.scaloz.superadmin.service;

import com.scaloz.superadmin.dto.ProductDTO;
import com.scaloz.superadmin.model.Product;
import com.scaloz.superadmin.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private org.springframework.core.env.Environment environment;

    public List<ProductDTO> getAllProducts() {
        return productRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private String resolveApiKey(String productCode) {
        if (productCode == null || productCode.trim().isEmpty()) {
            return null;
        }
        productCode = productCode.trim();
        
        // 1. Try exact product code property: productCode.toLowerCase() + ".api.key" (e.g. hrms0001.api.key)
        String key = environment.getProperty(productCode.toLowerCase() + ".api.key");
        if (key != null && !key.trim().isEmpty()) return key.trim();
        
        // 2. Try prefix property (without trailing numbers): prefix.toLowerCase() + ".api.key" (e.g. hrms.api.key)
        String prefix = productCode.replaceAll("\\d+$", ""); // e.g. HRMS0001 -> HRMS
        if (!prefix.isEmpty()) {
            key = environment.getProperty(prefix.toLowerCase() + ".api.key");
            if (key != null && !key.trim().isEmpty()) return key.trim();
        }
        
        // 3. Try env var style property: productCode.toUpperCase() + "_API_KEY"
        key = environment.getProperty(productCode.toUpperCase() + "_API_KEY");
        if (key != null && !key.trim().isEmpty()) return key.trim();
        
        // 4. Try prefix env var style property: prefix.toUpperCase() + "_API_KEY"
        if (!prefix.isEmpty()) {
            key = environment.getProperty(prefix.toUpperCase() + "_API_KEY");
            if (key != null && !key.trim().isEmpty()) return key.trim();
        }
        
        // 5. Fallback to System environment variables directly
        String envValue = System.getenv(productCode.toUpperCase() + "_API_KEY");
        if (envValue != null && !envValue.trim().isEmpty()) return envValue.trim();
        
        if (!prefix.isEmpty()) {
            envValue = System.getenv(prefix.toUpperCase() + "_API_KEY");
            if (envValue != null && !envValue.trim().isEmpty()) return envValue.trim();
        }

        // 6. Last resort: default to "hrms.api.key"
        key = environment.getProperty("hrms.api.key");
        if (key != null && !key.trim().isEmpty()) return key.trim();

        return "xevyte_secure_api_key_2026_prod_v1"; // Hardcoded default fallback
    }

    private void populateDefaults(Product product) {
        String baseUrl = product.getUrl();
        if (baseUrl != null && !baseUrl.trim().isEmpty()) {
            baseUrl = baseUrl.trim();
            if (baseUrl.endsWith("/")) {
                baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            }
            product.setSyncTenantUrl(baseUrl + "/api/external/tenants");
            product.setSyncUserUrl(baseUrl + "/api/external/employees");
        }
        if (product.getApiKey() == null || product.getApiKey().trim().isEmpty()) {
            product.setApiKey(resolveApiKey(product.getCode()));
        }
    }

    @Transactional
    public ProductDTO createProduct(ProductDTO productDTO) {
        Product product = convertToEntity(productDTO);
        populateDefaults(product);
        Product savedProduct = productRepository.save(product);
        return convertToDTO(savedProduct);
    }

    @Transactional
    public ProductDTO updateProduct(Long id, ProductDTO productDetailsDTO) {
        Optional<Product> optionalProduct = productRepository.findById(id);
        if (optionalProduct.isPresent()) {
            Product product = optionalProduct.get();
            product.setName(productDetailsDTO.getName());
            product.setCode(productDetailsDTO.getCode());
            product.setUrl(productDetailsDTO.getUrl());
            product.setIcon(productDetailsDTO.getIcon());
            product.setContent(productDetailsDTO.getContent());
            product.setStatus(productDetailsDTO.getStatus());
            
            // Set values from DTO (they will be null if not passed, but we populate defaults right after)
            product.setSyncTenantUrl(productDetailsDTO.getSyncTenantUrl());
            product.setSyncUserUrl(productDetailsDTO.getSyncUserUrl());
            product.setApiKey(productDetailsDTO.getApiKey());
            
            populateDefaults(product);
            
            Product updatedProduct = productRepository.save(product);
            return convertToDTO(updatedProduct);
        }
        throw new RuntimeException("Product not found");
    }

    @Transactional
    public void deleteProduct(Long id) {
        if (productRepository.existsById(id)) {
            productRepository.deleteById(id);
        } else {
            throw new RuntimeException("Product not found");
        }
    }

    public Optional<ProductDTO> findProductByCode(String code) {
        return productRepository.findByCode(code).map(this::convertToDTO);
    }

    private ProductDTO convertToDTO(Product product) {
        ProductDTO dto = new ProductDTO();
        dto.setId(product.getId());
        dto.setName(product.getName());
        dto.setCode(product.getCode());
        dto.setUrl(product.getUrl());
        dto.setIcon(product.getIcon());
        dto.setContent(product.getContent());
        dto.setStatus(product.getStatus());
        dto.setSyncTenantUrl(product.getSyncTenantUrl());
        dto.setSyncUserUrl(product.getSyncUserUrl());
        dto.setApiKey(product.getApiKey());
        return dto;
    }

    private Product convertToEntity(ProductDTO dto) {
        Product product = new Product();
        product.setId(dto.getId());
        product.setName(dto.getName());
        product.setCode(dto.getCode());
        product.setUrl(dto.getUrl());
        product.setIcon(dto.getIcon());
        product.setContent(dto.getContent());
        product.setSyncTenantUrl(dto.getSyncTenantUrl());
        product.setSyncUserUrl(dto.getSyncUserUrl());
        product.setApiKey(dto.getApiKey());
        if (dto.getStatus() != null) {
            product.setStatus(dto.getStatus());
        }
        return product;
    }
}
