import {UniversalSocketServer} from "../lib/universal-socket-server";
import {ServerClientManager} from "./server-client-manager";
import {EMiddlewareType} from "./client";
import {createRequestPacket, IRespondPacket, SERVER, SERVER_PACKET} from "../lib/utls";
import Timeout = NodeJS.Timeout;

export interface ISeverProps {
	socketServer: UniversalSocketServer | UniversalSocketServer[];
	failTimeout?: number;
}

export interface IMiddlewaresServer {
	[EMiddlewareType.BEFORE_FIRE]: Function[],
	[EMiddlewareType.AFTER_FIRE]: Function[],
	[EMiddlewareType.ON_RECEIVE]: Function[],
	[EMiddlewareType.AFTER_RECEIVE_CALLBACK]: Function[],
	[EMiddlewareType.ON_REGISTER]: Function[],
}

export enum EBroadcastType {
	WAIT_ALL,
	WAIT_ALL_EXCEPT_UNDEFINED,
	RACE
}

export interface IServerFireOptions {
	client: string,
	eventName: string,
	failTimeout: number
}

interface IServerBroadcastOptions {
	broadcastType: EBroadcastType,
	eventName: string,
	failTimeout: number,
}

export class Server {

	failTimeout: number;
	socketServers: UniversalSocketServer[];
	clientManager: ServerClientManager;

	registeredCallbacks: object;
	private readonly middlewares: IMiddlewaresServer;

	constructor(props: ISeverProps) {
		this.failTimeout = props.failTimeout || 60000;
		this.socketServers = Array.isArray(props.socketServer) ? props.socketServer : [props.socketServer];
		this.clientManager = new ServerClientManager(this.socketServers);

		this.registeredCallbacks = {};
		this.middlewares = {
			[EMiddlewareType.BEFORE_FIRE]: [],
			[EMiddlewareType.AFTER_FIRE]: [],
			[EMiddlewareType.ON_RECEIVE]: [],
			[EMiddlewareType.AFTER_RECEIVE_CALLBACK]: [],
			[EMiddlewareType.ON_REGISTER]: [],
		};
	}

	register(eventName: string, callback: Function) {
		for (let md of this.middlewares[EMiddlewareType.ON_REGISTER]) {
			let {$eventName, $callback} = md(eventName, callback);
			if ($eventName) eventName = $eventName;
			if ($callback) callback = $callback;
		}

		if (this.registeredCallbacks[eventName]) throw new Error(`Callback for ${eventName} has already been registered.`);

		this.registeredCallbacks[eventName] = callback;
	}

	use(type: EMiddlewareType, middleware: Function) {
		if(type === EMiddlewareType.ON_CONNECTION || type === EMiddlewareType.ON_DISCONNECTION) {
			this.clientManager.use(type, middleware);
		} else {
			this.middlewares[type].push(middleware);
		}
	}

	useFirst(type: EMiddlewareType, middleware: Function) {
		if(type === EMiddlewareType.ON_CONNECTION || type === EMiddlewareType.ON_DISCONNECTION) {
			this.clientManager.useFirst(type, middleware);
		} else {
			this.middlewares[type].unshift(middleware);
		}
	}

	async $fire(settings: IServerFireOptions, ...args: any): Promise<any> {
		let {id, packet} = createRequestPacket(SERVER, settings.eventName, args);
		let clientSocket = this.clientManager.getClientById(settings.client);

		const promise: Promise<any> = new Promise((resolve, reject) => {
			const timerId: Timeout = setTimeout(() => {
				reject(new Error('Request timeout'))
			}, settings.failTimeout);
			clientSocket.once(`${id}`, (packet: IRespondPacket) => {
				clearTimeout(timerId);
				if (!packet.status) {
					reject(new Error(packet.error));
					return
				}
				if (packet.id !== id) {
					reject(new Error('Packet id missmatch'));
					return;
				}
				resolve(packet.result)
			})
		});

		let shouldBreak = false;
		let retRes = undefined;
		let $break = (res) => {
			shouldBreak = true;
			retRes = res;
		};

		for (let md of this.middlewares[EMiddlewareType.BEFORE_FIRE]) {
			let res = await md($break, packet);
			if (shouldBreak) {
				return retRes;
			}
			if (res) packet = res;
		}
		clientSocket.emit(SERVER_PACKET, packet);

		let returnResult: any = await promise;

		shouldBreak = false;
		retRes = undefined;
		$break = (r) => {
			shouldBreak = true;
			retRes = r;
		};
		for (let md of this.middlewares[EMiddlewareType.AFTER_FIRE]) {
			const res = await md($break, returnResult);
			if (shouldBreak) {
				return retRes;
			}
			if (res) returnResult = res;
		}
		return returnResult;
	}

	async fire(client: string, eventName:string, ...args: any): Promise<any> {
		return await this.$fire({client, eventName, failTimeout: this.failTimeout}, ...args);
	}

	async $broadcast(settings: IServerBroadcastOptions, ...args: any): Promise<any> {
		let clients = this.clientManager.getAllClientIds();
		let promises = [];
		let createPromise;
		switch (settings.broadcastType) {
			case EBroadcastType.WAIT_ALL:
				createPromise = (settings: IServerFireOptions, ...args: any) => {
					return new Promise(async (resolve) => {
						let res = await this.$fire(settings, ...args);
						if(res) {
							resolve(res);
							return;
						}
						resolve(null);
					});
				};
				clients.forEach(client => {
					promises.push(createPromise({client, eventName: settings.eventName, failTimeout: settings.failTimeout}, ...args));
				});
				return await Promise.all(promises);
			case EBroadcastType.WAIT_ALL_EXCEPT_UNDEFINED:
				createPromise = (settings: IServerFireOptions, ...args: any) => {
					return new Promise(async (resolve) => {
						let res = await this.$fire(settings, ...args);
						if(res) {
							resolve(res);
							return;
						}
						resolve(null);
					});
				};
				clients.forEach(client => {
					promises.push(createPromise({client, eventName: settings.eventName, failTimeout: settings.failTimeout}, ...args));
				});
				let result = await Promise.all(promises);
				return result.filter(el => !!el);
			case EBroadcastType.RACE:
				createPromise = (settings: IServerFireOptions, ...args: any) => {
					return new Promise(async (resolve, reject) => {
						let res = await this.$fire(settings, ...args);
						if(res) {
							resolve(res);
						}
					});
				};
				clients.forEach(client => {
					promises.push(createPromise({client, eventName: settings.eventName, failTimeout: settings.failTimeout}, ...args));
				});
				return await Promise.race(promises);
			default:
				break;
		}
	}

	async broadcastWaitAll(eventName: string, ...args: any): Promise<any> {
		return await this.$broadcast({broadcastType: EBroadcastType.WAIT_ALL, failTimeout: this.failTimeout, eventName}, ...args);
	}

	async broadcastWaitNotNull(eventName: string, ...args: any): Promise<any> {
		return await this.$broadcast({broadcastType: EBroadcastType.WAIT_ALL_EXCEPT_UNDEFINED, failTimeout: this.failTimeout, eventName}, ...args);
	}

	async broadcastRace(eventName: string, ...args: any): Promise<any> {
		return await this.$broadcast({broadcastType: EBroadcastType.RACE, failTimeout: this.failTimeout, eventName}, ...args);
	}
}
