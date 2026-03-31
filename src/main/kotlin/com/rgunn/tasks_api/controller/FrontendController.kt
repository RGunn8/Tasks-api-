package com.rgunn.tasks_api.controller

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping

@Controller
class FrontendController {

    // Ensure consistent trailing slash to match Vite base (/app/)
    @GetMapping("/app")
    fun appRedirect(): String = "redirect:/app/"

    // Serve the React SPA from /app/
    @GetMapping("/app/")
    fun appRoot(): String = "forward:/app/index.html"

    // Client-side routes under /app/* should also return index.html (but avoid assets with dots).
    @GetMapping("/app/{path:[^\\.]*}")
    fun appRoutes(): String = "forward:/app/index.html"
}
