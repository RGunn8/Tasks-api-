package com.rgunn.tasks_api.repo

import com.rgunn.tasks_api.model.Task
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import java.util.UUID

interface TaskRepository : JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task>
