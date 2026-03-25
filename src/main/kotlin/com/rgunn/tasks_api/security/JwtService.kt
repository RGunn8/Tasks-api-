package com.rgunn.tasks_api.security

import com.rgunn.tasks_api.config.JwtProperties
import com.rgunn.tasks_api.model.GlobalRole
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.Date
import java.util.UUID

@Component
class JwtService(
    private val props: JwtProperties
) {
    private val key = Keys.hmacShaKeyFor(props.secret.toByteArray())

    fun createAccessToken(userId: UUID, email: String, role: GlobalRole): String {
        val now = Instant.now()
        val exp = now.plusSeconds(props.accessTokenMinutes * 60)

        return Jwts.builder()
            .setIssuer(props.issuer)
            .setSubject(userId.toString())
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(exp))
            .claim("email", email)
            .claim("role", role.name)
            .signWith(key, SignatureAlgorithm.HS256)
            .compact()
    }

    fun parseClaims(token: String): Claims {
        return Jwts.parserBuilder()
            .setSigningKey(key)
            .build()
            .parseClaimsJws(token)
            .body
    }

    fun getUserId(token: String): UUID = UUID.fromString(parseClaims(token).subject)
}
