package com.rgunn.tasks_api.dto

import jakarta.validation.constraints.NotBlank
import java.time.Instant

data class CreateTodoRequest(
    @field:NotBlank
    val title: String,
    val description: String?,
    val dueAt: Instant? = Instant.now(),
) {
}