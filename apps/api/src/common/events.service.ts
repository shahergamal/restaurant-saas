import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Thin bridge so services can push realtime events without depending on the gateway. */
@Injectable()
export class EventsService {
  private server?: Server;
  attach(server: Server) {
    this.server = server;
  }
  emitToBranch(orgId: string, branchId: string, event: string, payload: unknown) {
    this.server?.to(`org:${orgId}:branch:${branchId}`).emit(event, payload);
  }
}
