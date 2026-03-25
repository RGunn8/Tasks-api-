package com.rgunn.tasks_api.service

import com.rgunn.tasks_api.config.JwtProperties
import com.rgunn.tasks_api.dto.AuthResponse
import com.rgunn.tasks_api.dto.LoginRequest
import com.rgunn.tasks_api.dto.MeResponse
import com.rgunn.tasks_api.dto.RefreshRequest
import com.rgunn.tasks_api.dto.RegisterRequest
import com.rgunn.tasks_api.model.GlobalRole
import com.rgunn.tasks_api.model.RefreshToken
import com.rgunn.tasks_api.model.User
import com.rgunn.tasks_api.repo.RefreshTokenRepository
import com.rgunn.tasks_api.repo.UserRepository
import com.rgunn.tasks_api.security.JwtService
import com.rgunn.tasks_api.security.TokenHashing
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class AuthService(
    private val users: UserRepository,
    private val refreshTokens: RefreshTokenRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val jwtProps: JwtProperties
) {

    fun register(req: RegisterRequest): AuthResponse {
        val email = req.email.trim().lowercase()
        if (users.existsByEmail(email)) {
            throw IllegalArgumentException("email already registered")
        }

        val user = User(
            email = email,
            passwordHash = passwordEncoder.encode(req.password)!!,
            displayName = req.displayName,
            globalRole = GlobalRole.USER
        )
        val saved = users.save(user)
        return issueTokens(saved)
    }

    fun login(req: LoginRequest): AuthResponse {
        val email = req.email.trim().lowercase()
        val user = users.findByEmail(email) ?: throw IllegalArgumentException("invalid credentials")

        if (!passwordEncoder.matches(req.password, user.passwordHash)) {
            throw IllegalArgumentException("invalid credentials")
        }

        return issueTokens(user)
    }

    fun refresh(req: RefreshRequest): AuthResponse {
        val token = req.refreshToken.trim()
        val tokenHash = TokenHashing.sha256(token)

        val dbToken = refreshTokens.findByTokenHash(tokenHash)
            ?: throw IllegalArgumentException("invalid refresh token")

        if (!dbToken.isActive()) {
            throw IllegalArgumentException("refresh token expired or revoked")
        }

        val user = dbToken.user ?: throw IllegalStateException("refresh token missing user")

        // Rotate: revoke old token, create new token, link replaced_by
        val newRefreshPlain = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString()
        val newRefreshHash = TokenHashing.sha256(newRefreshPlain)

        val now = Instant.now()
        dbToken.revokedAt = now

        val newDbToken = RefreshToken(
            user = user,
            tokenHash = newRefreshHash,
            issuedAt = now,
            expiresAt = now.plus(jwtProps.refreshTokenDays, ChronoUnit.DAYS)
        )

        val savedNew = refreshTokens.save(newDbToken)
        dbToken.replacedByToken = savedNew
        refreshTokens.save(dbToken)

        val access = jwtService.createAccessToken(
            userId = user.id!!,
            email = user.email,
            role = user.globalRole
        )

        return AuthResponse(accessToken = access, refreshToken = newRefreshPlain)
    }

    fun logout(refreshToken: String) {
        val tokenHash = TokenHashing.sha256(refreshToken.trim())
        val dbToken = refreshTokens.findByTokenHash(tokenHash) ?: return
        if (dbToken.revokedAt == null) {
            dbToken.revokedAt = Instant.now()
            refreshTokens.save(dbToken)
        }
    }

    fun me(userId: UUID): MeResponse {
        val user = users.findById(userId).orElseThrow { IllegalArgumentException("user not found") }
        return MeResponse(
            id = user.id.toString(),
            email = user.email,
            displayName = user.displayName,
            role = user.globalRole.name
        )
    }

    private fun issueTokens(user: User): AuthResponse {
        val userId = user.id ?: throw IllegalStateException("user id missing")

        val access = jwtService.createAccessToken(
            userId = userId,
            email = user.email,
            role = user.globalRole
        )

        val refreshPlain = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString()
        val refreshHash = TokenHashing.sha256(refreshPlain)
        val now = Instant.now()

        refreshTokens.save(
            RefreshToken(
                user = user,
                tokenHash = refreshHash,
                issuedAt = now,
                expiresAt = now.plus(jwtProps.refreshTokenDays, ChronoUnit.DAYS)
            )
        )

        return AuthResponse(accessToken = access, refreshToken = refreshPlain)
    }
}
