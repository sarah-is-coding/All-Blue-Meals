// Which pasted URLs the importer may fetch. Only public web pages: the
// function runs on Supabase's servers, so fetching "localhost", a private
// network address, or a cloud metadata address (169.254.169.254) could reach
// things that aren't meant to be public (server-side request forgery).
//
// No Deno globals here, so the app's tests (Vitest) can import this module.
//
// Limit: a public host name whose DNS points at a private address isn't
// caught, since that needs a DNS lookup at fetch time. Every fetch, including
// each redirect hop, is still checked by host name and literal address.

/** Hosts that only make sense inside a network, never on the public web. */
const PRIVATE_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

const ipv4Parts = (host: string): number[] | null => {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  return numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? numbers : null;
};

const isPrivateIpv4 = ([a, b]: number[]): boolean =>
  a === 0 || // "this network"
  a === 10 || // private
  a === 127 || // loopback
  (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
  (a === 169 && b === 254) || // link-local, including cloud metadata
  (a === 172 && b >= 16 && b <= 31) || // private
  (a === 192 && b === 168) || // private
  (a === 198 && (b === 18 || b === 19)) || // benchmarking
  a >= 224; // multicast and reserved

const isPrivateIpv6 = (host: string): boolean => {
  const address = host.toLowerCase();
  if (address === "::" || address === "::1") return true; // unspecified, loopback
  if (/^f[cd]/.test(address)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(address)) return true; // link-local fe80::/10
  // An IPv4 address written as IPv6 (::ffff:10.0.0.1, or the hex form the
  // URL parser normalizes it to, ::ffff:a00:1): check the IPv4 part.
  const mapped = address.match(/^::ffff:(.+)$/);
  if (mapped) {
    const dotted = ipv4Parts(mapped[1]);
    if (dotted) return isPrivateIpv4(dotted);
    const hex = mapped[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      return isPrivateIpv4([high >> 8, high & 0xff]);
    }
    return true;
  }
  return false;
};

/**
 * True only for an http(s) URL on the default port whose host is a public
 * name or address. The URL parser normalizes tricks like "http://2130706433/"
 * or "http://0x7f.1/" to 127.0.0.1 before the check.
 */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  // Recipe pages are on the default ports; other ports are how internal
  // services are usually reached.
  if (url.port !== "") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost") return false;
  if (PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;

  if (host.startsWith("[") && host.endsWith("]")) return !isPrivateIpv6(host.slice(1, -1));
  const ipv4 = ipv4Parts(host);
  if (ipv4) return !isPrivateIpv4(ipv4);

  // A name with no dot ("intranet", "router") is a local name.
  return host.includes(".");
}
