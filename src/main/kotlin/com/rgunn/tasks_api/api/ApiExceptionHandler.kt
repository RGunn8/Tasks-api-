package com.rgunn.tasks_api.api

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ApiError> {
        val fields = ex.bindingResult.allErrors
            .filterIsInstance<FieldError>()
            .associate { it.field to (it.defaultMessage ?: "invalid") }

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiError(code = "validation_error", message = "validation failed", fields = fields))
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(ex: IllegalArgumentException): ResponseEntity<ApiError> {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiError(code = "bad_request", message = ex.message ?: "bad request"))
    }

    @ExceptionHandler(NotFoundException::class)
    fun handleNotFound(ex: NotFoundException): ResponseEntity<ApiError> {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiError(code = "not_found", message = ex.message ?: "not found"))
    }

    @ExceptionHandler(ForbiddenException::class)
    fun handleForbidden(ex: ForbiddenException): ResponseEntity<ApiError> {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiError(code = "forbidden", message = ex.message ?: "forbidden"))
    }

    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception): ResponseEntity<ApiError> {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiError(code = "internal_error", message = "unexpected error"))
    }
}

class NotFoundException(message: String) : RuntimeException(message)
class ForbiddenException(message: String) : RuntimeException(message)

data class ApiError(
    val code: String,
    val message: String,
    val fields: Map<String, String>? = null
)
