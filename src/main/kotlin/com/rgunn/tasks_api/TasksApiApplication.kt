package com.rgunn.tasks_api

import com.rgunn.tasks_api.config.JwtProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties::class)
class TasksApiApplication

fun main(args: Array<String>) {
    runApplication<TasksApiApplication>(*args)
}
