package com.scaloz.superadmin.controller;

import com.scaloz.superadmin.model.LoginSlide;
import com.scaloz.superadmin.repository.LoginSlideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
public class LoginSlideController {

    @Autowired
    private LoginSlideRepository loginSlideRepository;

    // Public endpoint for both login screens (no authentication required)
    @GetMapping("/api/public/slides")
    public List<LoginSlide> getAllPublicSlides() {
        return loginSlideRepository.findAll();
    }

    // Authenticated endpoint to get all slides (for Settings UI)
    @GetMapping("/api/settings/slides")
    public List<LoginSlide> getAllSettingsSlides() {
        return loginSlideRepository.findAll();
    }

    // Authenticated endpoint to save a new slide
    @PostMapping("/api/settings/slides")
    public ResponseEntity<LoginSlide> createSlide(@RequestBody LoginSlide slide) {
        LoginSlide savedSlide = loginSlideRepository.save(slide);
        return ResponseEntity.ok(savedSlide);
    }

    // Authenticated endpoint to delete a slide by ID
    @DeleteMapping("/api/settings/slides/{id}")
    public ResponseEntity<Void> deleteSlide(@PathVariable Long id) {
        if (loginSlideRepository.existsById(id)) {
            loginSlideRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
