/** Only explicitly safe, application-owned messages may cross the HTTP boundary. */
export class PublicError extends Error {
  /** Opaque reference to an already logged failure; never a raw dependency cause. */
  requestId?: string;
  constructor(message: string, public status = 400, options?: ErrorOptions) { super(message, options); }
}
