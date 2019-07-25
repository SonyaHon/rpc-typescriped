export interface UniversalSocket {
    onConnect(handler: Function);
    onDisconnect(handler: Function);
    close();
    on(eventName: string, handler: Function);
    once(eventName: string, handler: Function);
    emit(eventName: string, packet: any);
    id?: string;
    info?: any;
}
