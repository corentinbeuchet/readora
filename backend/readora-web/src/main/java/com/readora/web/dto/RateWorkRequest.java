package com.readora.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record RateWorkRequest(
        @Min(value = 1, message = "A rating is between 1 and 10")
        @Max(value = 10, message = "A rating is between 1 and 10")
        int score
) {
}
