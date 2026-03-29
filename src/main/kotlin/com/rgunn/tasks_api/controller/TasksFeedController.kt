package com.rgunn.tasks_api.controller

import com.rgunn.tasks_api.dto.CreateTaskGlobalRequest
import com.rgunn.tasks_api.dto.TaskResponse
import com.rgunn.tasks_api.dto.UpdateTaskRequest
import com.rgunn.tasks_api.model.TaskPriority
import com.rgunn.tasks_api.model.TaskStatus
import com.rgunn.tasks_api.service.TaskService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/v1/tasks")
class TasksFeedController(
    private val taskService: TaskService
) {

    @GetMapping
    fun listAll(
        auth: Authentication,
        @RequestParam(required = false) projectId: UUID?,
        @RequestParam(required = false) unlisted: Boolean?,
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false, name = "status") status: String?,
        @RequestParam(required = false) priority: TaskPriority?,
        @RequestParam(required = false) dueBefore: Instant?,
        @RequestParam(required = false) dueAfter: Instant?,
        @RequestParam(required = false) completed: Boolean?,
        pageable: Pageable
    ): Page<TaskResponse> {
        val ownerId = UUID.fromString(auth.name)
        val statuses = status
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?.map { TaskStatus.valueOf(it) }
            ?.toSet()

        return taskService.listAll(ownerId, projectId, unlisted, q, statuses, priority, dueBefore, dueAfter, completed, pageable)
    }

    @org.springframework.web.bind.annotation.PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        auth: Authentication,
        @RequestBody req: CreateTaskGlobalRequest
    ): TaskResponse {
        val ownerId = UUID.fromString(auth.name)
        return taskService.createGlobal(ownerId, req)
    }

    @PatchMapping("/{taskId}")
    fun updateById(
        auth: Authentication,
        @PathVariable taskId: UUID,
        @RequestBody req: UpdateTaskRequest
    ): TaskResponse {
        val ownerId = UUID.fromString(auth.name)
        return taskService.updateById(ownerId, taskId, req)
    }

    @DeleteMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteById(
        auth: Authentication,
        @PathVariable taskId: UUID
    ) {
        val ownerId = UUID.fromString(auth.name)
        taskService.deleteById(ownerId, taskId)
    }
}
