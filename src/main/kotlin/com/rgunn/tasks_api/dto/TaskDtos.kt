package com.rgunn.tasks_api.dto

import com.rgunn.tasks_api.model.TaskPriority
import com.rgunn.tasks_api.model.TaskStatus
import jakarta.validation.constraints.NotBlank
import java.time.Instant


data class CreateTaskRequest(
    @field:NotBlank
    val title: String,
    val description: String? = null,
    val status: TaskStatus? = null,
    val priority: TaskPriority? = null,
    val dueAt: Instant? = null
)

data class CreateTaskGlobalRequest(
    @field:NotBlank
    val title: String,
    val description: String? = null,
    val status: TaskStatus? = null,
    val priority: TaskPriority? = null,
    val dueAt: Instant? = null,

    // Optional: assign to a list on create.
    val projectId: java.util.UUID? = null
)

data class UpdateTaskRequest(
    val title: String? = null,
    val description: String? = null,
    val status: TaskStatus? = null,
    val priority: TaskPriority? = null,
    val dueAt: Instant? = null,
    val completedAt: Instant? = null,

    // Optional: move task to another project/list.
    val projectId: java.util.UUID? = null,

    // Optional: remove a task from any list.
    // (Needed because JSON null vs "missing" is ambiguous for Kotlin nullables.)
    val unlist: Boolean? = null
)

data class TaskResponse(
    val id: String,
    val projectId: String?,
    val title: String,
    val description: String?,
    val status: String,
    val priority: String?,
    val dueAt: String?,
    val completedAt: String?,
    val createdAt: String?,
    val updatedAt: String?
)
