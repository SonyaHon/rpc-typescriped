import {UniversalSocket} from "./universal-socket";

export interface UniversalSocketServer {
    onClientConnect(handler: (client: UniversalSocket) => void);
}
