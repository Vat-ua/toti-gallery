// This cookie remembers a presentation mode only. It is never authentication.
export const DEMO_MODE_COOKIE = "toti_demo";
export const DEMO_MODE_EVENT = "toti-demo-mode";
export function isDemoPath(pathname: string) {
  return pathname === "/demo" || pathname.startsWith("/demo/");
}
export function readDemoMode() {
  return document.cookie.split(";").some(part => part.trim() === `${DEMO_MODE_COOKIE}=1`);
}
export function writeDemoMode(active: boolean) {
  document.cookie = `${DEMO_MODE_COOKIE}=${active ? "1" : ""}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}${active ? "" : "; Max-Age=0"}`;
  window.dispatchEvent(new Event(DEMO_MODE_EVENT));
}
