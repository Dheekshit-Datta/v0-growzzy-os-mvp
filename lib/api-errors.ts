export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message, "VALIDATION_ERROR")
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, message, "AUTH_ERROR")
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = "Access denied") {
    super(403, message, "FORBIDDEN")
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, "NOT_FOUND")
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, "CONFLICT")
  }
}

export class InternalServerError extends ApiError {
  constructor(message = "Internal server error") {
    super(500, message, "INTERNAL_ERROR")
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      error: {
        code: error.code,
        message: error.message,
      },
    }
  }

  if (error instanceof Error) {
    console.error("[v0] Unhandled error:", error)
    return {
      statusCode: 500,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    }
  }

  return {
    statusCode: 500,
    error: {
      code: "INTERNAL_ERROR",
      message: "Unknown error",
    },
  }
}
