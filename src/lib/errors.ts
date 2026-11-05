/** Only explicitly safe, application-owned messages may cross the HTTP boundary. */
export class PublicError extends Error {
  constructor(message: string, public status = 400, options?: ErrorOptions) { super(message, options); }
}
