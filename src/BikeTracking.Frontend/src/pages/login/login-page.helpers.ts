import type { ErrorResponse } from '../../services/users-api'

export function validateInput(name: string, pin: string): string[] {
  const errors: string[] = []

  if (name.trim().length === 0) {
    errors.push('Name is required.')
  }

  if (!/^\d{4,8}$/.test(pin)) {
    errors.push('PIN must be numeric and 4 to 8 digits long.')
  }

  return errors
}

export function toErrors(error: ErrorResponse | undefined): string[] {
  if (!error) return ['Request failed.']
  if (error.details && error.details.length > 0) return error.details
  return [error.message || 'Request failed.']
}
