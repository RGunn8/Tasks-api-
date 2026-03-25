package com.rgunn.tasks_api

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
class ApiIntegrationTests {

    companion object {
        @Container
        private val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine").apply {
            withDatabaseName("task_app_db")
            withUsername("taskapp")
            withPassword("taskapp")
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") { postgres.jdbcUrl }
            registry.add("spring.datasource.username") { postgres.username }
            registry.add("spring.datasource.password") { postgres.password }
            registry.add("app.jwt.secret") { "change-me-change-me-change-me-change-me" }
        }
    }

    @Autowired
    lateinit var wac: WebApplicationContext

    private lateinit var mvc: MockMvc

    @BeforeEach
    fun setup() {
        mvc = MockMvcBuilders.webAppContextSetup(wac).build()
    }

    @Test
    fun `register then call me`() {
        val registerJson = """{"email":"it@example.com","password":"password123","displayName":"IT"}"""

        val auth = mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson)
        ).andReturn().response

        assertEquals(201, auth.status)

        val access = extractJsonField(auth.contentAsString, "accessToken")

        val me = mvc.perform(
            get("/api/v1/users/me")
                .header("Authorization", "Bearer $access")
        ).andReturn().response

        assertEquals(200, me.status)
    }

    @Test
    fun `create project and task`() {
        val registerJson = """{"email":"flow@example.com","password":"password123","displayName":"Flow"}"""

        val auth = mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson)
        ).andReturn().response

        val access = extractJsonField(auth.contentAsString, "accessToken")

        val projRes = mvc.perform(
            post("/api/v1/projects")
                .header("Authorization", "Bearer $access")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"MVP","description":"test"}""")
        ).andReturn().response

        assertEquals(201, projRes.status)
        val projectId = extractJsonField(projRes.contentAsString, "id")

        val taskRes = mvc.perform(
            post("/api/v1/projects/$projectId/tasks")
                .header("Authorization", "Bearer $access")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"Ship"}""")
        ).andReturn().response

        assertEquals(201, taskRes.status)

        val listRes = mvc.perform(
            get("/api/v1/projects/$projectId/tasks")
                .header("Authorization", "Bearer $access")
        ).andReturn().response

        assertEquals(200, listRes.status)
    }

    private fun extractJsonField(json: String, field: String): String {
        val regex = Regex("\"$field\"\\s*:\\s*\"([^\"]+)\"")
        return regex.find(json)?.groupValues?.get(1)
            ?: throw IllegalStateException("Missing field '$field' in: $json")
    }
}
