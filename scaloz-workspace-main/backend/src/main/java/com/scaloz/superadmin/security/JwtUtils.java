package com.scaloz.superadmin.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Component
public class JwtUtils {

    @Value("${scaloz.app.jwtSecret}")
    private String jwtSecret;

    @Value("${scaloz.app.jwtExpirationMs}")
    private int jwtExpirationMs;

    @Value("${scaloz.app.jwtIssuer:scaloz-iam}")
    private String jwtIssuer;

    private Key getSigningKey() {
        byte[] keyBytes = this.jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // ── Basic token (Super Admin) ─────────────────────────────────────
    public String generateToken(String username) {
        return Jwts.builder()
                .setIssuer(jwtIssuer)
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    // ── Enriched SSO token (Tenant users) ────────────────────────────
    // Includes: tenant, role, apps, employeeId for HRMS to consume
    public String generateToken(String username, Map<String, Object> extraClaims) {
        return Jwts.builder()
                .setIssuer(jwtIssuer)
                .setSubject(username)
                .addClaims(extraClaims)
                .setIssuedAt(new Date())
                .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String getUsernameFromToken(String token) {
        return getClaims(token).getSubject();
    }

    // ── Extract any claim by key ──────────────────────────────────────
    public Object extractClaim(String token, String claimKey) {
        return getClaims(token).get(claimKey);
    }

    public String extractStringClaim(String token, String claimKey) {
        Object val = getClaims(token).get(claimKey);
        return val != null ? val.toString() : null;
    }

    @SuppressWarnings("unchecked")
    public List<String> extractListClaim(String token, String claimKey) {
        Object val = getClaims(token).get(claimKey);
        if (val instanceof List) return (List<String>) val;
        return List.of();
    }

    // ── Validate issuer matches scaloz-iam ───────────────────────────
    public boolean validateIssuer(String token) {
        try {
            String issuer = getClaims(token).getIssuer();
            return jwtIssuer.equals(issuer);
        } catch (Exception e) {
            return false;
        }
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parserBuilder().setSigningKey(getSigningKey()).build().parseClaimsJws(authToken);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            System.err.println("Invalid JWT signature/token: " + e.getMessage());
        }
        return false;
    }

    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    // ── Dynamic custom secret token methods (Option 2) ────────────────
    private Key getSigningKey(String customSecret) {
        byte[] keyBytes = customSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] paddedBytes = new byte[32];
            System.arraycopy(keyBytes, 0, paddedBytes, 0, keyBytes.length);
            for (int i = keyBytes.length; i < 32; i++) {
                paddedBytes[i] = (byte) 0;
            }
            keyBytes = paddedBytes;
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String username, Map<String, Object> extraClaims, String customSecret) {
        return Jwts.builder()
                .setIssuer(jwtIssuer)
                .setSubject(username)
                .addClaims(extraClaims)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 300000)) // 5 minutes expiration
                .signWith(getSigningKey(customSecret), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateToken(String authToken, String customSecret) {
        try {
            Jwts.parserBuilder().setSigningKey(getSigningKey(customSecret)).build().parseClaimsJws(authToken);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            System.err.println("Invalid JWT signature/token with custom secret: " + e.getMessage());
        }
        return false;
    }

    public Claims getClaims(String token, String customSecret) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey(customSecret))
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
