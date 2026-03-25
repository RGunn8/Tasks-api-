package com.rgunn.tasks_api.repo

import com.rgunn.tasks_api.model.RefreshToken
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {

    fun findByTokenHash(tokenHash: String): RefreshToken?

    @Query(
        """
        select t from RefreshToken t
        where t.user.id = :userId
          and t.revokedAt is null
          and t.expiresAt > :now
        """
    )
    fun findActiveByUserId(@Param("userId") userId: UUID, @Param("now") now: Instant = Instant.now()): List<RefreshToken>
}
