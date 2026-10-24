/** Public, non-secret view of the session that is safe to send to the browser. */
export interface PublicSession {
  user: { email: string; name: string; picture?: string };
  expiresAt: number;
  csrfToken: string;
}
