import {UniversalSocketServer} from "../lib/universal-socket-server";
import {EMiddlewareType} from "./client";
import {UniversalSocket} from "../lib/universal-socket";
import uuid from 'uuid';
import {CLIENT_PACKET, IRequestPacket, IRequestPacketUnwrapped} from "../lib/utls";

export interface IMiddlewareServerClientManager {
    [EMiddlewareType.ON_CONNECTION]: Function[],
    [EMiddlewareType.ON_DISCONNECTION]: Function[],
}

export class ServerClientManager {

    middlewares: IMiddlewareServerClientManager;

    clientsPool: object;
    serverPool: object;

    constructor(servers: UniversalSocketServer[]) {
        this.middlewares = {
            [EMiddlewareType.ON_CONNECTION]: [],
            [EMiddlewareType.ON_DISCONNECTION]: [],
        };

        this.clientsPool = {};
        this.serverPool = {};

        this.setupServers(servers);
    }

    use(type: EMiddlewareType, middleware: Function) {}

    useFirst(type: EMiddlewareType, middleware: Function) {}

    setupServers(servers: UniversalSocketServer[]) {
        servers.forEach(this.setupServer.bind(this));
    }

    setupServer(server: UniversalSocketServer) {
        let serverId = uuid();
        this.serverPool[serverId] = server;
        server.onClientConnect((socket) => {
            this.setupClient(serverId, socket);
        });
    }

    setupClient(serverId: string,socket: UniversalSocket) {
        let socketId = socket.id;
        let clientId = `${serverId}::${socketId}`;
        this.clientsPool[clientId] = socket;
        console.log(this.clientsPool);

        socket.onDisconnect(() => {
            delete this.clientsPool[clientId];
        });

        socket.on(CLIENT_PACKET, async(packet: IRequestPacketUnwrapped) => {
        })
    }

    getClientById(clientId: string): UniversalSocket {
        return this.clientsPool[clientId];
    }
    getAllClientIds(): string[] {
        return Object.keys(this.clientsPool);
    }
}
