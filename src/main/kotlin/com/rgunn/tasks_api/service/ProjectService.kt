package com.rgunn.tasks_api.service

import com.rgunn.tasks_api.api.ForbiddenException
import com.rgunn.tasks_api.api.NotFoundException
import com.rgunn.tasks_api.dto.CreateProjectRequest
import com.rgunn.tasks_api.dto.ProjectResponse
import com.rgunn.tasks_api.dto.UpdateProjectRequest
import com.rgunn.tasks_api.model.Project
import com.rgunn.tasks_api.repo.ProjectRepository
import com.rgunn.tasks_api.repo.UserRepository
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class ProjectService(
    private val projects: ProjectRepository,
    private val users: UserRepository
) {

    fun create(ownerId: UUID, req: CreateProjectRequest): ProjectResponse {
        val owner = users.findById(ownerId).orElseThrow { NotFoundException("user not found") }
        val project = Project(
            owner = owner,
            name = req.name,
            description = req.description
        )
        return projects.save(project).toResponse()
    }

    fun list(ownerId: UUID): List<ProjectResponse> {
        return projects.findAllByOwnerId(ownerId).map { it.toResponse() }
    }

    fun get(ownerId: UUID, projectId: UUID): ProjectResponse {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")
        return project.toResponse()
    }

    fun update(ownerId: UUID, projectId: UUID, req: UpdateProjectRequest): ProjectResponse {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")

        req.name?.let { project.name = it }
        if (req.description != null) project.description = req.description

        return projects.save(project).toResponse()
    }

    fun delete(ownerId: UUID, projectId: UUID) {
        val project = projects.findById(projectId).orElseThrow { NotFoundException("project not found") }
        if (project.owner?.id != ownerId) throw ForbiddenException("not your project")
        projects.delete(project)
    }

    private fun Project.toResponse(): ProjectResponse {
        return ProjectResponse(
            id = id.toString(),
            name = name,
            description = description,
            createdAt = createdAt?.toString(),
            updatedAt = updatedAt?.toString()
        )
    }
}
