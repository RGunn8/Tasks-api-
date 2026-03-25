package com.rgunn.tasks_api.repo

import com.rgunn.tasks_api.model.Task
import com.rgunn.tasks_api.model.TaskPriority
import com.rgunn.tasks_api.model.TaskStatus
import org.springframework.data.jpa.domain.Specification
import java.time.Instant
import java.util.UUID

object TaskSpecifications {

    fun projectId(projectId: UUID): Specification<Task> = Specification { root, _, cb ->
        cb.equal(root.get<Any>("project").get<UUID>("id"), projectId)
    }

    fun textQuery(q: String): Specification<Task> = Specification { root, _, cb ->
        val like = "%" + q.lowercase() + "%"
        cb.or(
            cb.like(cb.lower(root.get("title")), like),
            cb.like(cb.lower(root.get("description")), like)
        )
    }

    fun statusIn(statuses: Set<TaskStatus>): Specification<Task> = Specification { root, _, cb ->
        root.get<TaskStatus>("status").`in`(statuses)
    }

    fun priorityEq(priority: TaskPriority): Specification<Task> = Specification { root, _, cb ->
        cb.equal(root.get<TaskPriority>("priority"), priority)
    }

    fun dueBefore(ts: Instant): Specification<Task> = Specification { root, _, cb ->
        cb.lessThan(root.get("dueAt"), ts)
    }

    fun dueAfter(ts: Instant): Specification<Task> = Specification { root, _, cb ->
        cb.greaterThan(root.get("dueAt"), ts)
    }

    fun completed(completed: Boolean): Specification<Task> = Specification { root, _, cb ->
        if (completed) cb.isNotNull(root.get<Instant>("completedAt")) else cb.isNull(root.get<Instant>("completedAt"))
    }
}
