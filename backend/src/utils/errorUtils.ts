/**
 * Utility functions for error handling and logging
 */

/**
 * Converts an unknown error to a safe object for logging
 * @param error - The error to convert
 * @returns A safe object that can be logged
 */
export function errorToLogObject(error: unknown): Record<string, any> {
  if (error === null || error === undefined) {
    return { error: 'Unknown error' };
  }

  if (typeof error === 'string') {
    return { error, message: error };
  }

  if (typeof error === 'number' || typeof error === 'boolean') {
    return { error: String(error) };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      name: error.name,
      stack: error.stack,
      ...(error.cause && { cause: errorToLogObject(error.cause) })
    };
  }

  if (typeof error === 'object') {
    try {
      // Try to serialize the object
      const serialized = JSON.parse(JSON.stringify(error));
      return { error: serialized };
    } catch {
      // If serialization fails, convert to string
      return { error: String(error) };
    }
  }

  return { error: String(error) };
}

/**
 * Safely extracts error message from unknown error
 * @param error - The error to extract message from
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Unknown error occurred';
}

/**
 * Checks if an error is a specific type of error
 * @param error - The error to check
 * @param errorType - The error constructor to check against
 * @returns True if the error is of the specified type
 */
export function isErrorOfType<T extends Error>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * Creates a standardized error response object
 * @param message - The error message
 * @param code - The error code
 * @param details - Additional error details
 * @returns A standardized error response
 */
export function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, any>
) {
  return {
    success: false,
    error: message,
    code,
    ...(details && { details })
  };
}