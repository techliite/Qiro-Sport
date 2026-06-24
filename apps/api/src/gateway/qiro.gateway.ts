import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { WsEvent, VirtualLeague } from '@qiro/types'

// Rooms: 'vf:league-a', 'vf:league-b', 'horse-racing', 'user:{userId}'

@WebSocketGateway({
  cors: {
    origin: [
      process.env['WEB_URL'] ?? 'http://localhost:3000',
      process.env['ADMIN_URL'] ?? 'http://localhost:3001',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class QiroGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(QiroGateway.name)

  afterInit() {
    this.logger.log('WebSocket gateway initialized')
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`)

    const league = client.handshake.query['league'] as string | undefined
    if (league === 'a')   client.join('vf:league-a')
    if (league === 'b')   client.join('vf:league-b')
    if (league === 'all') { client.join('vf:league-a'); client.join('vf:league-b') }

    const game = client.handshake.query['game'] as string | undefined
    if (game === 'horse-racing') client.join('horse-racing')

    const userId = client.handshake.query['userId'] as string | undefined
    if (userId) client.join(`user:${userId}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  // ── Virtual Football emitters ──────────────────────────────────────────────

  emitVFEvent(league: VirtualLeague, event: WsEvent, payload: unknown) {
    const room = league === VirtualLeague.A ? 'vf:league-a' : 'vf:league-b'
    this.server.to(room).emit(event, payload)
  }

  // ── Horse Racing emitters ──────────────────────────────────────────────────

  emitHREvent(event: WsEvent, payload: unknown) {
    this.server.to('horse-racing').emit(event, payload)
  }

  // ── User private emitters ──────────────────────────────────────────────────

  emitToUser(userId: string, event: WsEvent, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload)
  }
}
