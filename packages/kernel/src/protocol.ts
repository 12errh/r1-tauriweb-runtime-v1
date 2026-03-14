/**
 * Represents a request sent from the main thread to the Kernel Worker.
 */
export interface KernelRequest {
  /** Unique nanoid used to match the response back to this request */
  id: string;
  /** Command name, e.g. 'IPC_INVOKE' or 'VFS_READ' */
  type: string;
  /** JSON-serialisable payload */
  payload: unknown;
}

/**
 * Represents a response sent from the Kernel Worker back to the main thread.
 */
export interface KernelResponse {
  /** Matches the request id */
  id: string;
  /** The result data. Undefined if an error occurred. */
  payload?: unknown;
  /** The error string. Undefined on success. */
  error?: string;
}
