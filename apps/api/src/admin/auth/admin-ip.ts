import type { Request } from 'express'

// Express reports IPv4 clients on dual-stack sockets as ::ffff:1.2.3.4
export function getClientIp(request: Request): string {
  const ip = request.ip ?? request.socket.remoteAddress ?? ''
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

export function parseIpList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
}
