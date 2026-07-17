package com.flowtrack.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

@Component
public class EncryptionFilter extends OncePerRequestFilter {

    private final EncryptionUtils encryptionUtils;
    private final ObjectMapper objectMapper;

    public EncryptionFilter(EncryptionUtils encryptionUtils) {
        this.encryptionUtils = encryptionUtils;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        // Only process JSON requests
        String contentType = request.getContentType();
        boolean isJsonRequest = contentType != null && contentType.toLowerCase().contains("application/json");
        
        HttpServletRequest requestToUse = request;

        if (isJsonRequest && !request.getMethod().equalsIgnoreCase("GET")) {
            String requestBody = request.getReader().lines().collect(Collectors.joining(System.lineSeparator()));
            if (requestBody != null && !requestBody.trim().isEmpty()) {
                try {
                    JsonNode node = objectMapper.readTree(requestBody);
                    if (node.has("payload") && node.get("payload").isTextual()) {
                        String encryptedPayload = node.get("payload").asText();
                        String decryptedBody = encryptionUtils.decrypt(encryptedPayload);
                        requestToUse = new DecryptedRequestWrapper(request, decryptedBody);
                    } else {
                        requestToUse = new DecryptedRequestWrapper(request, requestBody); // Pass through if not encrypted
                    }
                } catch (Exception e) {
                    // Fallback pass through
                    requestToUse = new DecryptedRequestWrapper(request, requestBody);
                }
            }
        }

        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);

        filterChain.doFilter(requestToUse, responseWrapper);

        // Process Response
        String responseContentType = responseWrapper.getContentType();
        boolean isJsonResponse = responseContentType != null && responseContentType.toLowerCase().contains("application/json");

        if (isJsonResponse) {
            byte[] responseArray = responseWrapper.getContentAsByteArray();
            String responseStr = new String(responseArray, StandardCharsets.UTF_8);

            if (!responseStr.isEmpty()) {
                try {
                    String encryptedResponse = encryptionUtils.encrypt(responseStr);
                    ObjectNode payloadNode = objectMapper.createObjectNode();
                    payloadNode.put("payload", encryptedResponse);
                    
                    byte[] encryptedBytes = objectMapper.writeValueAsBytes(payloadNode);
                    responseWrapper.resetBuffer();
                    responseWrapper.setContentLength(encryptedBytes.length);
                    responseWrapper.getOutputStream().write(encryptedBytes);

                    // Fix Content-Length hanging issue by explicitly overriding it on the original response
                    response.setContentLength(encryptedBytes.length);
                    if (response.containsHeader("Content-Length")) {
                        response.setHeader("Content-Length", String.valueOf(encryptedBytes.length));
                    }
                } catch (Exception e) {
                    // Fallback on error
                }
            }
        }
        
        responseWrapper.copyBodyToResponse();
    }

    private static class DecryptedRequestWrapper extends HttpServletRequestWrapper {
        private final byte[] body;

        public DecryptedRequestWrapper(HttpServletRequest request, String decryptedBody) {
            super(request);
            this.body = decryptedBody.getBytes(StandardCharsets.UTF_8);
        }

        @Override
        public ServletInputStream getInputStream() {
            final ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return byteArrayInputStream.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                }

                @Override
                public int read() {
                    return byteArrayInputStream.read();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(this.getInputStream(), StandardCharsets.UTF_8));
        }
        
        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
