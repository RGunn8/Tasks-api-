package com.rgunn.tasks_api.repo

import com.rgunn.tasks_api.model.Project
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProjectRepository : JpaRepository<Project, UUID> {
    fun findAllByOwnerId(ownerId: UUID): List<Project>
}
