import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
@WebSocketGateway({ cors: { origin: true } })
export class ModbusGateway { @WebSocketServer() server: Server; publish(data: unknown) { this.server.emit('telemetry', data); } }
