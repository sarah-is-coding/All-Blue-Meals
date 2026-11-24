import { isPublicHttpUrl } from "../../../../../supabase/functions/import-recipes/urlSafety.ts";

// The importer may only fetch public web pages; anything that could reach the
// function's own network is refused.
describe("isPublicHttpUrl", () => {
  it.each([
    "https://www.allrecipes.com/recipe/123/tacos/",
    "http://example.com/soup",
    "https://cooking.nytimes.com/recipes/1?x=1#y",
    "https://8.8.8.8/",
    "https://[2606:4700:4700::1111]/",
  ])("allows the public page %s", (url) => {
    expect(isPublicHttpUrl(url)).toBe(true);
  });

  it.each([
    ["not a URL", "recipe please"],
    ["a non-web scheme", "file:///etc/passwd"],
    ["ftp", "ftp://example.com/recipe"],
    ["localhost", "http://localhost/admin"],
    ["a .localhost name", "http://api.localhost/"],
    ["a .local name", "http://printer.local/"],
    ["a .internal name", "http://metadata.google.internal/"],
    ["a bare intranet name", "http://intranet/"],
    ["loopback", "http://127.0.0.1/"],
    ["loopback written as a number", "http://2130706433/"],
    ["loopback written in hex", "http://0x7f.1/"],
    ["a private 10.x address", "http://10.1.2.3/"],
    ["a private 172.16-31 address", "http://172.20.0.5/"],
    ["a private 192.168 address", "http://192.168.1.1/"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["carrier-grade NAT", "http://100.64.0.1/"],
    ["0.0.0.0", "http://0.0.0.0/"],
    ["IPv6 loopback", "http://[::1]/"],
    ["IPv6 unique local", "http://[fd12:3456::1]/"],
    ["IPv6 link-local", "http://[fe80::1]/"],
    ["IPv4-mapped private IPv6", "http://[::ffff:10.0.0.1]/"],
    ["a non-default port", "https://example.com:8443/recipe"],
    ["credentials in the URL", "https://user:pass@example.com/"],
  ])("refuses %s", (_label, url) => {
    expect(isPublicHttpUrl(url)).toBe(false);
  });
});
