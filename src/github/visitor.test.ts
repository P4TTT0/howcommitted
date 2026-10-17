import { describe, expect, it } from "vitest";
import {
  clientIp,
  ipKey,
  newVisitorId,
  resolveVisitor,
  signVisitorId,
  verifyVisitorCookie,
} from "./visitor";

describe("visitor cookie", () => {
  it("round-trips a signed id", () => {
    const id = newVisitorId();
    expect(verifyVisitorCookie(signVisitorId(id, "s3cret"), "s3cret")).toBe(id);
  });

  it("rejects tampered, foreign-secret and malformed values", () => {
    const signed = signVisitorId("abc", "s3cret");
    expect(
      verifyVisitorCookie(signed.replace("abc", "abd"), "s3cret"),
    ).toBeNull();
    expect(verifyVisitorCookie(signed, "other")).toBeNull();
    expect(verifyVisitorCookie("nodot", "s3cret")).toBeNull();
    expect(verifyVisitorCookie("abc.short", "s3cret")).toBeNull();
    expect(verifyVisitorCookie(undefined, "s3cret")).toBeNull();
  });
});

describe("clientIp", () => {
  it("prefers the platform headers over a client-controlled x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "6.6.6.6, 10.0.0.1",
      "x-vercel-forwarded-for": "2.2.2.2",
      "x-real-ip": "1.2.3.4",
    });
    expect(clientIp(headers)).toBe("1.2.3.4");
    headers.delete("x-real-ip");
    expect(clientIp(headers)).toBe("2.2.2.2");
    headers.delete("x-vercel-forwarded-for");
    expect(clientIp(headers)).toBe("6.6.6.6");
  });

  it("ignores values that are not IP addresses", () => {
    expect(clientIp(new Headers({ "x-real-ip": "not-an-ip" }))).toBe("unknown");
    expect(
      clientIp(
        new Headers({ "x-real-ip": "garbage", "x-forwarded-for": "7.7.7.7" }),
      ),
    ).toBe("7.7.7.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("keys IPv6 clients by their /64", () => {
    const a = clientIp(new Headers({ "x-real-ip": "2001:db8:1:2:aaaa::1" }));
    const b = clientIp(new Headers({ "x-real-ip": "2001:db8:1:2:bbbb::9" }));
    expect(a).toBe("2001:db8:1:2::/64");
    expect(b).toBe(a);
    expect(ipKey("2001:db8:1:3::1")).not.toBe(a);
    expect(ipKey("::1")).toBe("0:0:0:0::/64");
  });

  it("treats IPv4-mapped IPv6 as IPv4", () => {
    expect(ipKey("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
});

describe("resolveVisitor", () => {
  it("mints a cookie for new visitors and reuses a valid one", () => {
    const first = resolveVisitor(
      new Headers({ "x-forwarded-for": "9.9.9.9" }),
      "s3cret",
    );
    expect(first.visitor.ip).toBe("9.9.9.9");
    expect(first.setCookie).toContain("HttpOnly");

    const cookie = first.setCookie?.split(";")[0] ?? "";
    const second = resolveVisitor(
      new Headers({ cookie: `theme=dark; ${cookie}` }),
      "s3cret",
    );
    expect(second.visitor.cookieId).toBe(first.visitor.cookieId);
    expect(second.setCookie).toBeNull();
  });

  it("replaces a cookie signed with another secret", () => {
    const first = resolveVisitor(new Headers(), "old");
    const cookie = first.setCookie?.split(";")[0] ?? "";
    const second = resolveVisitor(new Headers({ cookie }), "new");
    expect(second.visitor.cookieId).not.toBe(first.visitor.cookieId);
    expect(second.setCookie).not.toBeNull();
  });
});
