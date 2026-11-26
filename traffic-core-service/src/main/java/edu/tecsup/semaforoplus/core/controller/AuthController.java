package edu.tecsup.semaforoplus.core.controller;

import edu.tecsup.semaforoplus.core.dto.LoginRequest;
import edu.tecsup.semaforoplus.core.service.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest req) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.username(), req.password())
            );
            String role = auth.getAuthorities().stream().findFirst().map(Object::toString).orElse("ROLE_OPERATOR");
            String token = jwtService.generateToken(auth.getName(), role);
            return ResponseEntity.ok(Map.of(
                    "authenticated", true,
                    "username", auth.getName(),
                    "role", role,
                    "token", token
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("authenticated", false, "message", "Credenciales inválidas"));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("authenticated", false));
        }
        String role = auth.getAuthorities().stream().findFirst().map(Object::toString).orElse("ROLE_OPERATOR");
        return ResponseEntity.ok(Map.of("authenticated", true, "username", auth.getName(), "role", role));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout() {
        return ResponseEntity.ok(Map.of("authenticated", false));
    }
}
