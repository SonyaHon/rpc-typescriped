import {UniversalSocketServer} from "../lib/universal-socket-server";
import {UniversalSocket} from "../lib/universal-socket";
import {UsSocketIO} from './us-socket.io';
import * as SocketIO from "socket.io";

export class UsSocketIoServer implements UniversalSocketServer {
    ioServer: SocketIO.Server;
    constructor(ioServer: SocketIO.Server) {
        this.ioServer = ioServer;
    }

    onClientConnect(handler: (client: UniversalSocket) => void) {
        this.ioServer.on('connection', (ioSocket) => {
            let usSocket = new UsSocketIO(ioSocket);
            handler(usSocket);
        })
    }
}
