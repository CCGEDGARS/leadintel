const encoder = new TextEncoder();

export function allowedOrigin(request, configuredOrigin) {
  const origin = request.headers.get("Origin") || "";
  return origin === configuredOrigin ? origin : "";
}

export function corsHeaders(origin) {
  return origin ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Vary": "Origin"
  } : {};
}

export async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2,"0")).join("");
}

export function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes); crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}

export function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left)); const b = encoder.encode(String(right));
  let mismatch = a.length ^ b.length;
  for(let index=0; index<Math.max(a.length,b.length); index++) mismatch |= (a[index%a.length]||0) ^ (b[index%b.length]||0);
  return mismatch === 0;
}

export function cookieValue(request, name) {
  const match = (request.headers.get("Cookie")||"").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function sessionCookie(token, maxAge) {
  return `leadintel_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`;
}

export const clearSessionCookie = "leadintel_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None";
