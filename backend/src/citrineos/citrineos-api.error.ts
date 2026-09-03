export class CitrineOsApiError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'CitrineOsApiError';
  }
}
