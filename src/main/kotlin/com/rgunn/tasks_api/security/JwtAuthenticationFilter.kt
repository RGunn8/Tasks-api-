package com.rgunn.tasks_api.security

import io.jsonwebtoken.JwtException
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthenticationFilter(
    private val jwtService: JwtService
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val header = request.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            val token = header.removePrefix("Bearer ").trim()
            try {
                val claims = jwtService.parseClaims(token)
                val userId = claims.subject
                val role = claims["role"]?.toString()

                val authorities = if (role != null) {
                    listOf(SimpleGrantedAuthority("ROLE_${role}"))
                } else {
                    emptyList()
                }

                val auth = UsernamePasswordAuthenticationToken(userId, null, authorities)
                SecurityContextHolder.getContext().authentication = auth
            } catch (_: JwtException) {
                // invalid token -> proceed unauthenticated
            } catch (_: IllegalArgumentException) {
                // proceed unauthenticated
            }
        }

        filterChain.doFilter(request, response)
    }
}
