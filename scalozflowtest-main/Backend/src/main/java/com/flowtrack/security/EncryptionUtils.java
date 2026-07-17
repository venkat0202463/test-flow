package com.flowtrack.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class EncryptionUtils {

    private final SecretKeySpec secretKey;

    public EncryptionUtils(@Value("${encryption.key}") String encryptionKeyStr) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(encryptionKeyStr.getBytes(StandardCharsets.UTF_8));
        this.secretKey = new SecretKeySpec(hash, "AES");
    }

    public String encrypt(String rawJson) {
        try {
            if (rawJson == null || rawJson.isEmpty()) return rawJson;
            
            byte[] iv = new byte[16]; // 16-byte IV for CBC
            new SecureRandom().nextBytes(iv);
            javax.crypto.spec.IvParameterSpec parameterSpec = new javax.crypto.spec.IvParameterSpec(iv);

            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            byte[] encrypted = cipher.doFinal(rawJson.getBytes(StandardCharsets.UTF_8));
            
            String ivHex = bytesToHex(iv);
            String cipherText = Base64.getEncoder().encodeToString(encrypted);
            
            return ivHex + ":" + cipherText;
        } catch (Exception e) {
            e.printStackTrace();
            return rawJson;
        }
    }

    public String decrypt(String encryptedString) {
        try {
            if (encryptedString == null || !encryptedString.contains(":")) return encryptedString;
            
            String[] parts = encryptedString.split(":");
            if (parts.length != 2) return encryptedString;
            
            byte[] iv = hexStringToByteArray(parts[0]);
            byte[] cipherText = Base64.getDecoder().decode(parts[1]);
            
            javax.crypto.spec.IvParameterSpec parameterSpec = new javax.crypto.spec.IvParameterSpec(iv);
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);
            
            byte[] decrypted = cipher.doFinal(cipherText);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return encryptedString;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                    + Character.digit(s.charAt(i+1), 16));
        }
        return data;
    }
}
