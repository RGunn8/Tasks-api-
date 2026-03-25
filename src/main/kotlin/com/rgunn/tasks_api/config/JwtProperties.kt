package com.rgunn.tasks_api.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "app.jwt")
data class JwtProperties(
    val secret: String,
    val issuer: String = "tasks-api",
    val accessTokenMinutes: Long = 15,
    val refreshTokenDays: Long = 14
)
