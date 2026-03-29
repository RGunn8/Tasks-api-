package com.rgunn.tasks_api.controller

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping

@Controller
class FrontendController {

    // Serve the React SPA from /app/
    @GetMapping("/app", "/app/")
    fun appRoot(): String = "forward:/app/index.html"

    // Client-side routes under /app/* should also return index.html (but avoid assets with dots).
    @GetMapping("/app/{path:[^\\.]*}")
    fun appRoutes(): String = "forward:/app/index.html"
}
