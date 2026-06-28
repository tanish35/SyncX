import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "syncx_session";
const SESSION_TTL_DAYS = 30;

function getKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
}

export async function createSessionCookie(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getKey(secret));

  return [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_DAYS * 86400}`,
  ].join("; ");
}

export async function getSession(
  request: Request,
  secret: string,
): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;

  const token = match[1];
  try {
    const { payload } = await jwtVerify(token, getKey(secret));
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
