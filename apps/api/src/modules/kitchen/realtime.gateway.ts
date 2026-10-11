import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { allowedOrigins, config } from '../../config';
import { EventsService } from '../../common/events.service';
import { ACCESS_COOKIE, AccessClaims } from '../../common/guards';

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Realtime channel (KDS, orders, tables). Clients join only their own organization + branch room. */
@WebSocketGateway({
  path: '/ws',
  cors: { origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, !origin || allowedOrigins().includes(origin)), credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  constructor(
    private readonly jwt: JwtService,
    private readonly events: EventsService,
  ) {}

  afterInit(server: Server) {
    this.events.attach(server);
  }

  async handleConnection(socket: Socket) {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && !allowedOrigins().includes(origin)) throw new Error('origin');
      const token = readCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);
      if (!token) throw new Error('no token');
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, { secret: config().JWT_ACCESS_SECRET, algorithms: ['HS256'] });
      await socket.join(`org:${claims.org}:branch:${claims.br}`);
    } catch {
      socket.emit('auth_error');
      socket.disconnect(true);
    }
  }
}
