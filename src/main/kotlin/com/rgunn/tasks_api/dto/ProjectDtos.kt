package com.rgunn.tasks_api.dto

import jakarta.validation.constraints.NotBlank

data class CreateProjectRequest(
    @field:NotBlank
    val name: String,
    val description: String? = null
)

data class UpdateProjectRequest(
    val name: String? = null,
    val description: String? = null
)

data class ProjectResponse(
    val id: String,
    val name: String,
    val description: String?,
    val createdAt: String?,
    val updatedAt: String?
)
