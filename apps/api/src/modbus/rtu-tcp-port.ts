import { EventEmitter } from "events";
import { Socket } from "net";

const EXCEPTION_LENGTH = 5;
const MIN_WRITE_DATA_LENGTH = 4;
const MAX_BUFFER_LENGTH = 256;
const READ_DEVICE_IDENTIFICATION_FUNCTION_CODE = 43;
const REPORT_SERVER_ID_FUNCTION_CODE = 17;
const LENGTH_UNKNOWN = -1;

/**
 * A Modbus RTU frame (address + PDU + CRC16, no MBAP header) tunneled through a
 * plain TCP socket. This is what a transparent serial-to-Ethernet converter
 * (e.g. USR-TCP232-306 in "TCP Server" work mode) actually expects: it relays
 * raw bytes to/from its serial port and has no notion of Modbus TCP framing.
 * modbus-serial ships no such port: connectTCP and connectTcpRTUBuffered both
 * wrap requests in an MBAP header on the wire, they only differ in response
 * parsing. This mirrors modbus-serial's own RTUBufferedPort (real serial),
 * swapping the SerialPort transport for a net.Socket, and follows TcpPort's
 * pattern of reporting connect/error through the open()/close() callback
 * instead of emitting "error" (which throws if unhandled).
 */
export class RtuTcpPort extends EventEmitter {
  private client = new Socket();
  private connectOptions: { host: string; port: number };
  private callback?: (error?: Error) => void;
  private openFlag = false;
  private buffer = Buffer.alloc(0);
  private id = 0;
  private cmd = 0;
  private length: number = LENGTH_UNKNOWN;

  constructor(host: string, options: { port?: number; timeout?: number }) {
    super();
    this.connectOptions = { host, port: options.port || 502 };
    if (options.timeout) this.client.setTimeout(options.timeout);
    const handleCallback = (error?: Error) => {
      if (this.callback) {
        this.callback(error);
        this.callback = undefined;
      }
    };
    this.client.on("connect", () => {
      this.openFlag = true;
      handleCallback();
    });
    this.client.on("close", () => {
      if (this.openFlag) {
        this.openFlag = false;
        this.buffer = Buffer.alloc(0);
        handleCallback();
        this.emit("close");
        this.removeAllListeners();
      }
    });
    this.client.on("error", (error) => {
      this.openFlag = false;
      handleCallback(error);
    });
    this.client.on("timeout", () =>
      handleCallback(new Error("RtuTcpPort connection timed out")),
    );
    this.client.on("data", (data: Buffer) => this.onData(data));
  }
  get isOpen() {
    return this.openFlag;
  }
  open(callback: (error?: Error) => void) {
    this.callback = callback;
    this.client.connect(this.connectOptions);
  }
  close(callback: (error?: Error) => void) {
    this.callback = callback;
    this.client.end();
  }
  write(data: Buffer) {
    if (data.length < MIN_WRITE_DATA_LENGTH) return;
    this.id = data[0];
    this.cmd = data[1];
    switch (this.cmd) {
      case 1:
      case 2: {
        const bits = data.readUInt16BE(4);
        this.length = 3 + Math.ceil(bits / 8) + 2;
        break;
      }
      case 3:
      case 4: {
        const registers = data.readUInt16BE(4);
        this.length = 3 + 2 * registers + 2;
        break;
      }
      case 5:
      case 6:
      case 15:
      case 16:
        this.length = 6 + 2;
        break;
      case REPORT_SERVER_ID_FUNCTION_CODE:
      case READ_DEVICE_IDENTIFICATION_FUNCTION_CODE:
        this.length = LENGTH_UNKNOWN;
        break;
      default:
        this.length = 0;
    }
    this.client.write(data);
  }
  private onData(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);
    let bufferLength = this.buffer.length;
    if (bufferLength < EXCEPTION_LENGTH) return;
    if (bufferLength > MAX_BUFFER_LENGTH) {
      this.buffer = this.buffer.slice(-MAX_BUFFER_LENGTH);
      bufferLength = MAX_BUFFER_LENGTH;
    }
    const maxOffset = bufferLength - EXCEPTION_LENGTH;
    for (let i = 0; i <= maxOffset; i++) {
      const unitId = this.buffer[i];
      const functionCode = this.buffer[i + 1];
      if (unitId !== this.id) continue;
      if (
        functionCode === this.cmd &&
        (functionCode === READ_DEVICE_IDENTIFICATION_FUNCTION_CODE ||
          functionCode === REPORT_SERVER_ID_FUNCTION_CODE)
      ) {
        // Device-identification style responses carry a self-describing length;
        // this integration never issues those requests, so just wait for more data.
        return;
      }
      if (functionCode === this.cmd && i + this.length <= bufferLength) {
        this.emitData(i, this.length);
        return;
      }
      if (
        functionCode === (0x80 | this.cmd) &&
        i + EXCEPTION_LENGTH <= bufferLength
      ) {
        this.emitData(i, EXCEPTION_LENGTH);
        return;
      }
    }
  }
  private emitData(start: number, length: number) {
    const frame = this.buffer.slice(start, start + length);
    this.buffer = this.buffer.slice(start + length);
    this.emit("data", frame);
  }
}
