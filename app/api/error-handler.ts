import { NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-errors"

export function handleError(error: unknown) {
  const { statusCode, error: errorObj } = handleApiError(error)
  return NextResponse.json(errorObj, { status: statusCode })
}

export function withErrorHandler(handler: (req: any) => Promise<Response>) {
  return async (req: any) => {
    try {
      return await handler(req)
    } catch (error) {
      return handleError(error)
    }
  }
}
