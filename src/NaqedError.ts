export class NaqedError extends Error {
  public readonly details: any
  constructor (message: string, details?: any) {
    super(message)
    this.details = details
    this.name = 'NaqedError'
  }
}
