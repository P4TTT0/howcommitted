import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Identity used for the anonymous quota: an opaque signed cookie id plus the IP key. */
export type Visitor = {
  /** Quota key of the client IP: the address for IPv4, the /64 prefix for IPv6, or "unknown". */
  ip: string;
  cookieId: string;
};

export const VISITOR_COOKIE = "hc_visitor";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const UNKNOWN_IP = "unknown";

export function newVisitorId(): string {
  return randomUUID();
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

export function signVisitorId(id: string, secret: string): string {
  return `${id}.${sign(id, secret)}`;
}

/** Returns the visitor id when the cookie value carries a valid signature. */
export function verifyVisitorCookie(
  value: string | undefined,
  secret: string,
): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(id, secret));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? id : null;
}

/** Expands an IPv6 address (optionally with an embedded IPv4 tail) into 8 numeric groups. */
function ipv6Groups(ip: string): number[] {
  let text = ip.split("%")[0] ?? ip;
  const tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (tail) {
    const [, a, b, c, d] = tail.map(Number) as [
      number,
      number,
      number,
      number,
      number,
    ];
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = "", rest] = text.split("::");
  const front = head ? head.split(":") : [];
  const back = rest ? rest.split(":") : [];
  const fill = rest === undefined ? 0 : 8 - front.length - back.length;
  return [...front, ...Array<string>(fill).fill("0"), ...back].map((group) =>
    Number.parseInt(group, 16),
  );
}

/** Keys IPv6 clients by /64 (one household or host owns the whole prefix), IPv4 by address. */
export function ipKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const groups = ipv6Groups(ip);
  // IPv4-mapped (::ffff:a.b.c.d) is really an IPv4 client.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const [high = 0, low = 0] = groups.slice(6);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}::/64`;
}

/**
 * Best-effort client IP key. Vercel sets x-real-ip and x-vercel-forwarded-for
 * itself, so they win over x-forwarded-for, which a client can prepend to.
 * Anything that is not a valid IP is ignored.
 */
export function clientIp(headers: Headers): string {
  const candidates = [
    headers.get("x-real-ip"),
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip && isIP(ip) !== 0) return ipKey(ip);
  }
  return UNKNOWN_IP;
}

export function readCookie(headers: Headers, name: string): string | undefined {
  const header = headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

/**
 * Builds the quota identity for a request. When the request has no valid
 * cookie a new id is minted and `setCookie` carries the header to send back.
 */
export function resolveVisitor(
  headers: Headers,
  secret: string,
): { visitor: Visitor; setCookie: string | null } {
  const ip = clientIp(headers);
  const existing = verifyVisitorCookie(
    readCookie(headers, VISITOR_COOKIE),
    secret,
  );
  if (existing) return { visitor: { ip, cookieId: existing }, setCookie: null };

  const cookieId = newVisitorId();
  const attributes = [
    `${VISITOR_COOKIE}=${signVisitorId(cookieId, secret)}`,
    "Path=/",
    `Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return { visitor: { ip, cookieId }, setCookie: attributes.join("; ") };
}
