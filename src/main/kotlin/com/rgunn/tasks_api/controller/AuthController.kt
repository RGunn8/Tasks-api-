package com.rgunn.tasks_api.controller

import com.rgunn.tasks_api.dto.AuthResponse
import com.rgunn.tasks_api.dto.LoginRequest
import com.rgunn.tasks_api.dto.LogoutRequest
import com.rgunn.tasks_api.dto.RefreshRequest
import com.rgunn.tasks_api.dto.RegisterRequest
import com.rgunn.tasks_api.service.AuthService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val authService: AuthService
) {

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody req: RegisterRequest): AuthResponse = authService.register(req)

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest): AuthResponse = authService.login(req)

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody req: RefreshRequest): AuthResponse = authService.refresh(req)

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun logout(@Valid @RequestBody req: LogoutRequest) {
        authService.logout(req.refreshToken)
    }
}
