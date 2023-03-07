export function cleanseIPAddress(ipAddress) {
  return ipAddress.replace(/\./g, "p");
}
