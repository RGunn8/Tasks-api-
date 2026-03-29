package com.rgunn.tasks_api.service

import com.rgunn.tasks_api.api.ForbiddenException
import com.rgunn.tasks_api.api.NotFoundException
import com.rgunn.tasks_api.dto.CreateTaskRequest
import com.rgunn.tasks_api.dto.TaskResponse
import com.rgunn.tasks_api.dto.UpdateTaskRequest
import com.rgunn.tasks_api.model.Task
import com.rgunn.tasks_api.repo.ProjectRepository
import com.rgunn.tasks_api.repo.TaskRepository
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class TaskService(
    private val tasks: TaskRepository,
    private val projects: ProjectRepository
) {

    fun create(ownerId: UUID, projectId: UUID, req: CreateTaskRequest): TaskResponse {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")

        val task = Task(
            title = req.title,
            description = req.description,
            status = req.status ?: com.rgunn.tasks_api.model.TaskStatus.TODO,
            priority = req.priority,
            dueAt = req.dueAt,
            project = project
        )
        return tasks.save(task).toResponse()
    }

    fun list(
        ownerId: UUID,
        projectId: UUID,
        q: String?,
        statuses: Set<com.rgunn.tasks_api.model.TaskStatus>?,
        priority: com.rgunn.tasks_api.model.TaskPriority?,
        dueBefore: java.time.Instant?,
        dueAfter: java.time.Instant?,
        completed: Boolean?,
        pageable: org.springframework.data.domain.Pageable
    ): org.springframework.data.domain.Page<TaskResponse> {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")

        var spec: org.springframework.data.jpa.domain.Specification<Task> = com.rgunn.tasks_api.repo.TaskSpecifications.projectId(projectId)

        if (!q.isNullOrBlank()) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.textQuery(q))
        if (statuses != null && statuses.isNotEmpty()) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.statusIn(statuses))
        if (priority != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.priorityEq(priority))
        if (dueBefore != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.dueBefore(dueBefore))
        if (dueAfter != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.dueAfter(dueAfter))
        if (completed != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.completed(completed))

        return tasks.findAll(spec, pageable).map { it.toResponse() }
    }

    fun get(ownerId: UUID, projectId: UUID, taskId: UUID): TaskResponse {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")

        val task = tasks.findById(taskId).orElseThrow { NotFoundException("task not found") }
        if (task.project?.id != projectId) throw NotFoundException("task not found")

        return task.toResponse()
    }

    fun update(ownerId: UUID, projectId: UUID, taskId: UUID, req: UpdateTaskRequest): TaskResponse {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")

        val task = tasks.findById(taskId).orElseThrow { NotFoundException("task not found") }
        if (task.project?.id != projectId) throw NotFoundException("task not found")

        req.title?.let { task.title = it }
        if (req.description != null) task.description = req.description
        req.status?.let { task.status = it }
        req.priority?.let { task.priority = it }
        req.dueAt?.let { task.dueAt = it }
        if (req.completedAt != null) task.completedAt = req.completedAt

        // Optional: move task to a different project/list.
        if (req.projectId != null && req.projectId != task.project?.id) {
            val target = projects.findById(req.projectId).orElseThrow { NotFoundException("project not found") }
            if (target.owner?.id != ownerId) throw ForbiddenException("not your project")
            task.project = target
        }

        return tasks.save(task).toResponse()
    }

    fun updateById(ownerId: UUID, taskId: UUID, req: UpdateTaskRequest): TaskResponse {
        val task = tasks.findById(taskId).orElseThrow { NotFoundException("task not found") }
        if (task.project?.owner?.id != ownerId) throw ForbiddenException("not your task")

        req.title?.let { task.title = it }
        if (req.description != null) task.description = req.description
        req.status?.let { task.status = it }
        req.priority?.let { task.priority = it }
        req.dueAt?.let { task.dueAt = it }
        if (req.completedAt != null) task.completedAt = req.completedAt

        if (req.projectId != null && req.projectId != task.project?.id) {
            val target = projects.findById(req.projectId).orElseThrow { NotFoundException("project not found") }
            if (target.owner?.id != ownerId) throw ForbiddenException("not your project")
            task.project = target
        }

        return tasks.save(task).toResponse()
    }

    fun delete(ownerId: UUID, projectId: UUID, taskId: UUID) {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")

        val task = tasks.findById(taskId).orElseThrow { NotFoundException("task not found") }
        if (task.project?.id != projectId) throw NotFoundException("task not found")

        tasks.delete(task)
    }

    fun deleteById(ownerId: UUID, taskId: UUID) {
        val task = tasks.findById(taskId).orElseThrow { NotFoundException("task not found") }
        if (task.project?.owner?.id != ownerId) throw ForbiddenException("not your task")
        tasks.delete(task)
    }

    fun listAll(
        ownerId: UUID,
        projectId: UUID?,
        q: String?,
        statuses: Set<com.rgunn.tasks_api.model.TaskStatus>?,
        priority: com.rgunn.tasks_api.model.TaskPriority?,
        dueBefore: java.time.Instant?,
        dueAfter: java.time.Instant?,
        completed: Boolean?,
        pageable: org.springframework.data.domain.Pageable
    ): org.springframework.data.domain.Page<TaskResponse> {
        var spec: org.springframework.data.jpa.domain.Specification<Task> = com.rgunn.tasks_api.repo.TaskSpecifications.ownerId(ownerId)

        if (projectId != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.projectId(projectId))
        if (!q.isNullOrBlank()) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.textQuery(q))
        if (statuses != null && statuses.isNotEmpty()) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.statusIn(statuses))
        if (priority != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.priorityEq(priority))
        if (dueBefore != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.dueBefore(dueBefore))
        if (dueAfter != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.dueAfter(dueAfter))
        if (completed != null) spec = spec.and(com.rgunn.tasks_api.repo.TaskSpecifications.completed(completed))

        return tasks.findAll(spec, pageable).map { it.toResponse() }
    }

    private fun Task.toResponse(): TaskResponse {
        return TaskResponse(
            id = id.toString(),
            projectId = project?.id.toString(),
            title = title,
            description = description,
            status = status.name,
            priority = priority?.name,
            dueAt = dueAt?.toString(),
            completedAt = completedAt?.toString(),
            createdAt = createdAt?.toString(),
            updatedAt = updatedAt?.toString()
        )
    }
}
