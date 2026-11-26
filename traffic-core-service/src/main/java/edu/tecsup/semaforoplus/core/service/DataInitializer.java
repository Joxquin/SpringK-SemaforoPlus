package edu.tecsup.semaforoplus.core.service;

import edu.tecsup.semaforoplus.core.model.IntersectionEntity;
import edu.tecsup.semaforoplus.core.model.UserEntity;
import edu.tecsup.semaforoplus.core.repository.IntersectionRepository;
import edu.tecsup.semaforoplus.core.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    private final UserRepository userRepository;
    private final IntersectionRepository intersectionRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(
            UserRepository userRepository,
            IntersectionRepository intersectionRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.intersectionRepository = intersectionRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.findByUsername("admin").isEmpty()) {
            userRepository.save(new UserEntity(
                    "admin",
                    passwordEncoder.encode("admin123"),
                    "ROLE_ADMIN",
                    "Administrador Semáforo+"
            ));
        }
        if (userRepository.findByUsername("operador").isEmpty()) {
            userRepository.save(new UserEntity(
                    "operador",
                    passwordEncoder.encode("via2026"),
                    "ROLE_OPERATOR",
                    "Operador Centro de Control"
            ));
        }
        if (intersectionRepository.findById("INT-01").isEmpty()) {
            intersectionRepository.save(new IntersectionEntity(
                    "INT-01",
                    "Av. Ejército × Calle Los Arces",
                    "Yanahuara",
                    "ADAPTATIVO",
                    "STANDBY",
                    -16.3923,
                    -71.5476
            ));
        }
    }
}
