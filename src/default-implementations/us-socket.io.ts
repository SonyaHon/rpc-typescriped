import {UniversalSocket} from "../lib/universal-socket";
import {Socket} from "socket.io";


export class UsSocketIO implements UniversalSocket {
    private s: Socket;
    public id: string;

    constructor(s: Socket) {
        this.s = s;
        this.id = this.s.id;
    }
    close() {
        // @ts-ignore
        this.s.close();
    }
    emit(eventName: string, packet: any) {
        this.s.emit(eventName, packet);
    }
    on(eventName: string, handler: Function) {
        // @ts-ignore
        this.s.on(eventName, handler);
    }
    onConnect(handler: Function) {
        // @ts-ignore
        this.s.on('connect', handler);
    }
    onDisconnect(handler: Function) {
        // @ts-ignore
        this.s.on('disconnect', handler);
    }
    once(eventName: string, handler: Function) {
        // @ts-ignore
        this.s.once(eventName, handler);
    }


}
