/** Raised for a non-2xx answer from the read API. `message` is the API's own `error` field when present. */
export class StealthpadApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.name = "StealthpadApiError";
    this.status = status;
    this.path = path;
  }

  /** True for 429: wait one full window (60 s on /api/claimable) before retrying. */
  get rateLimited(): boolean {
    return this.status === 429;
  }
}

/** Raised by local checks before anything is signed or sent. */
export class StealthpadInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StealthpadInputError";
  }
}
