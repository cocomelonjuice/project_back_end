import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const frontendUrl = process.env.FRONTEND_URL?.trim();
const socketAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(frontendUrl ? [frontendUrl] : []),
];

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: socketAllowedOrigins,
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authToken = client.handshake.auth?.token;
      const queryToken = client.handshake.query?.token;
      const token =
        typeof authToken === 'string'
          ? authToken
          : typeof queryToken === 'string'
            ? queryToken
            : Array.isArray(queryToken)
              ? queryToken[0]
              : null;

      if (!token) {
        this.logger.debug('Socket connection rejected: missing token');
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
        token,
      );
      const userId = payload?.sub;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      (client.data as { userId?: string }).userId = userId;
      await client.join(`user:${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string })?.userId;
    if (userId) {
      void client.leave(`user:${userId}`);
    }
  }

  /** Push a new notification to all sockets for the given user. */
  emitNotificationNew(userId: string, payload: Record<string, unknown>) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }
}
