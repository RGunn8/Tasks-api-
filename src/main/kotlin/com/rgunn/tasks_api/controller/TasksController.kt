package com.rgunn.tasks_api.controller

import com.rgunn.tasks_api.dto.CreateTaskRequest
import com.rgunn.tasks_api.dto.TaskResponse
import com.rgunn.tasks_api.dto.UpdateTaskRequest
import com.rgunn.tasks_api.service.TaskService
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
@RequestMapping("/api/v1/projects/{projectId}/tasks")
class TasksController(
    private val taskService: TaskService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        auth: Authentication,
        @PathVariable projectId: UUID,
        @Valid @RequestBody req: CreateTaskRequest
    ): TaskResponse {
        val ownerId = UUID.fromString(auth.name)
        return taskService.create(ownerId, projectId, req)
    }

    @GetMapping
    fun list(
        auth: Authentication,
        @PathVariable projectId: UUID,
        @org.springframework.web.bind.annotation.RequestParam(required = false) q: String?,
        @org.springframework.web.bind.annotation.RequestParam(required = false, name = "status") status: String?,
        @org.springframework.web.bind.annotation.RequestParam(required = false) priority: com.rgunn.tasks_api.model.TaskPriority?,
        @org.springframework.web.bind.annotation.RequestParam(required = false) dueBefore: java.time.Instant?,
        @org.springframework.web.bind.annotation.RequestParam(required = false) dueAfter: java.time.Instant?,
        @org.springframework.web.bind.annotation.RequestParam(required = false) completed: Boolean?,
        pageable: org.springframework.data.domain.Pageable
    ): org.springframework.data.domain.Page<TaskResponse> {
        val ownerId = UUID.fromString(auth.name)
        val statuses = status
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?.map { com.rgunn.tasks_api.model.TaskStatus.valueOf(it) }
            ?.toSet()

        return taskService.list(ownerId, projectId, q, statuses, priority, dueBefore, dueAfter, completed, pageable)
    }

    @GetMapping("/{taskId}")
    fun get(
        auth: Authentication,
        @PathVariable projectId: UUID,
        @PathVariable taskId: UUID
    ): TaskResponse {
        val ownerId = UUID.fromString(auth.name)
        return taskService.get(ownerId, projectId, taskId)
    }

    @PatchMapping("/{taskId}")
    fun update(
        auth: Authentication,
        @PathVariable projectId: UUID,
        @PathVariable taskId: UUID,
        @RequestBody req: UpdateTaskRequest
    ): TaskResponse {
        val ownerId = UUID.fromString(auth.name)
        return taskService.update(ownerId, projectId, taskId, req)
    }

    @DeleteMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        auth: Authentication,
        @PathVariable projectId: UUID,
        @PathVariable taskId: UUID
    ) {
        val ownerId = UUID.fromString(auth.name)
        taskService.delete(ownerId, projectId, taskId)
    }
}
