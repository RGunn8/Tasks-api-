package com.rgunn.tasks_api.controller

import com.rgunn.tasks_api.dto.CreateProjectRequest
import com.rgunn.tasks_api.dto.ProjectResponse
import com.rgunn.tasks_api.dto.UpdateProjectRequest
import com.rgunn.tasks_api.service.ProjectService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/projects")
class ProjectsController(
    private val projectService: ProjectService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(auth: Authentication, @Valid @RequestBody req: CreateProjectRequest): ProjectResponse {
        val ownerId = UUID.fromString(auth.name)
        return projectService.create(ownerId, req)
    }

    @GetMapping
    fun list(auth: Authentication): List<ProjectResponse> {
        val ownerId = UUID.fromString(auth.name)
        return projectService.list(ownerId)
    }

    @GetMapping("/{projectId}")
    fun get(auth: Authentication, @PathVariable projectId: UUID): ProjectResponse {
        val ownerId = UUID.fromString(auth.name)
        return projectService.get(ownerId, projectId)
    }

    @PatchMapping("/{projectId}")
    fun update(
        auth: Authentication,
        @PathVariable projectId: UUID,
        @RequestBody req: UpdateProjectRequest
    ): ProjectResponse {
        val ownerId = UUID.fromString(auth.name)
        return projectService.update(ownerId, projectId, req)
    }

    @DeleteMapping("/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(auth: Authentication, @PathVariable projectId: UUID) {
        val ownerId = UUID.fromString(auth.name)
        projectService.delete(ownerId, projectId)
    }
}
