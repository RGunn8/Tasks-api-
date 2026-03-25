package com.rgunn.tasks_api.controller

import com.rgunn.tasks_api.dto.MeResponse
import com.rgunn.tasks_api.service.AuthService
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/users")
class UsersController(
    private val authService: AuthService
) {

    @GetMapping("/me")
    fun me(auth: Authentication): MeResponse {
        val userId = UUID.fromString(auth.name)
        return authService.me(userId)
    }
}
