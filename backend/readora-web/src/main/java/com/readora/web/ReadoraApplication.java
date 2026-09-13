package com.readora.web;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.readora")
@EntityScan(basePackages = "com.readora.infrastructure.persistence")
@EnableJpaRepositories(basePackages = "com.readora.infrastructure.persistence")
public class ReadoraApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReadoraApplication.class, args);
    }
}
