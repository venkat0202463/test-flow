package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.dto.ProductDTO;
import com.scaloz.superadmin.service.ProductService;
import com.scaloz.superadmin.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @GetMapping
    public List<ProductDTO> getAllProducts() {
        return productService.getAllProducts();
    }

    @PostMapping
    public ResponseEntity<?> createProduct(@RequestBody ProductDTO productDTO) {
        if (productDTO.getName() != null && productDTO.getName().length() > 100) {
            return ResponseEntity.badRequest().body("Product Name cannot exceed 100 characters.");
        }
        if (productDTO.getCode() != null && productDTO.getCode().length() > 50) {
            return ResponseEntity.badRequest().body("Product Code cannot exceed 50 characters.");
        }
        if (productDTO.getUrl() != null && productDTO.getUrl().length() > 100) {
            return ResponseEntity.badRequest().body("Base URL cannot exceed 100 characters.");
        }
        if (productDTO.getContent() != null && productDTO.getContent().length() > 500) {
            return ResponseEntity.badRequest().body("Product Description cannot exceed 500 characters.");
        }

        if (productDTO.getCode() != null && !productDTO.getCode().trim().isEmpty()) {
            if (productRepository.findByCode(productDTO.getCode().trim()).isPresent()) {
                return ResponseEntity.badRequest().body("Product Code is already existing.");
            }
        }
        try {
            ProductDTO savedProduct = productService.createProduct(productDTO);
            return ResponseEntity.ok(savedProduct);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error creating product: " + e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Long id, @RequestBody ProductDTO productDetailsDTO) {
        if (productDetailsDTO.getName() != null && productDetailsDTO.getName().length() > 100) {
            return ResponseEntity.badRequest().body("Product Name cannot exceed 100 characters.");
        }
        if (productDetailsDTO.getCode() != null && productDetailsDTO.getCode().length() > 50) {
            return ResponseEntity.badRequest().body("Product Code cannot exceed 50 characters.");
        }
        if (productDetailsDTO.getUrl() != null && productDetailsDTO.getUrl().length() > 100) {
            return ResponseEntity.badRequest().body("Base URL cannot exceed 100 characters.");
        }
        if (productDetailsDTO.getContent() != null && productDetailsDTO.getContent().length() > 500) {
            return ResponseEntity.badRequest().body("Product Description cannot exceed 500 characters.");
        }

        if (productDetailsDTO.getCode() != null && !productDetailsDTO.getCode().trim().isEmpty()) {
            Optional<com.scaloz.superadmin.model.Product> duplicateOpt = productRepository.findByCode(productDetailsDTO.getCode().trim());
            if (duplicateOpt.isPresent() && !duplicateOpt.get().getId().equals(id)) {
                return ResponseEntity.badRequest().body("Product Code is already existing.");
            }
        }

        try {
            ProductDTO updatedProduct = productService.updateProduct(id, productDetailsDTO);
            return ResponseEntity.ok(updatedProduct);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error updating product: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        try {
            productService.deleteProduct(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /api/products/upload-icon
     * Accepts a multipart image file, converts it to base64, and returns the data URL.
     */
    @PostMapping(value = "/upload-icon", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadIcon(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided."));
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("message", "Icon file must be smaller than 2MB."));
        }

        try {
            byte[] bytes = file.getBytes();
            String contentType = file.getContentType();
            if (contentType == null) {
                contentType = "image/png";
            }
            String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
            String iconUrl = "data:" + contentType + ";base64," + base64;
            return ResponseEntity.ok(Map.of("iconUrl", iconUrl));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to process icon: " + e.getMessage()));
        }
    }
}
