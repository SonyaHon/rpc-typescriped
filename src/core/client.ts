import {CLIENT, CLIENT_PACKET, createRequestPacket, createRespondPacket, IRequestPacketUnwrapped, IRespondPacket, SERVER_PACKET} from "../lib/utls";
import {UniversalSocket} from "../lib/universal-socket";
import Timeout = NodeJS.Timeout;

export interface IClientProps {
	socket: UniversalSocket,
	failTimeout?: number
}

export interface IFireOptions {
	eventName: string,
	failTimeout: number
}

export enum EMiddlewareType {
	BEFORE_FIRE,
	AFTER_FIRE,
	ON_RECEIVE,
	AFTER_RECEIVE_CALLBACK,
	ON_CONNECTION,
	ON_DISCONNECTION,
	ON_REGISTER
}

export interface IMiddlewaresClient {
	[EMiddlewareType.BEFORE_FIRE]: Function[],
	[EMiddlewareType.AFTER_FIRE]: Function[],
	[EMiddlewareType.ON_RECEIVE]: Function[],
	[EMiddlewareType.AFTER_RECEIVE_CALLBACK]: Function[],
	[EMiddlewareType.ON_CONNECTION]: Function[],
	[EMiddlewareType.ON_DISCONNECTION]: Function[],
	[EMiddlewareType.ON_REGISTER]: Function[],
}

export class Client {

	private socket: UniversalSocket;
	private readonly failTimeout: number;

	registeredCallbacks: object;
	private readonly middlewares: IMiddlewaresClient;

	constructor(props: IClientProps) {
		this.socket = props.socket;
		this.failTimeout = props.failTimeout || 60000;
		this.registeredCallbacks = {};
		this.middlewares = {
			[EMiddlewareType.BEFORE_FIRE]: [],
			[EMiddlewareType.AFTER_FIRE]: [],
			[EMiddlewareType.ON_RECEIVE]: [],
			[EMiddlewareType.AFTER_RECEIVE_CALLBACK]: [],
			[EMiddlewareType.ON_CONNECTION]: [],
			[EMiddlewareType.ON_DISCONNECTION]: [],
			[EMiddlewareType.ON_REGISTER]: [],
		};

		this.socket.on(SERVER_PACKET, async (packet: IRequestPacketUnwrapped) => {
			await this._setupIncomingPacketHandler(packet);
		});

		this.socket.onConnect(async () => {
			let shouldBreak = false;
			let $break = () => {
				shouldBreak = true;
			};
			for (const md of this.middlewares[EMiddlewareType.ON_CONNECTION]) {
				await md($break);
				if (shouldBreak) {
					this.socket.close();
					break;
				}
			}
		});

		this.socket.onDisconnect(async () => {
			for (const md of this.middlewares[EMiddlewareType.ON_DISCONNECTION]) {
				await md();
			}
		})

	}

	use(type: EMiddlewareType, middleware: Function) {
		this.middlewares[type].push(middleware);
	}

	useFirst(type: EMiddlewareType, middleware: Function) {
		this.middlewares[type].unshift(middleware);
	}

	async fire(eventName: string, ...args: any): Promise<any> {
		return await this.$fire({eventName, failTimeout: this.failTimeout}, ...args)
	}

	async $fire(settings: IFireOptions, ...args: any): Promise<any> {
		let {id, packet} = createRequestPacket(CLIENT, settings.eventName, args);

		const promise: Promise<any> = new Promise((resolve, reject) => {
			const timerId: Timeout = setTimeout(() => {
				reject(new Error('Request timeout'))
			}, settings.failTimeout);

			this.socket.once(`${id}`, (packet: IRespondPacket) => {
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

		this.socket.emit(CLIENT_PACKET, packet);
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

	register(eventName: string, callback: Function) {
		for (let md of this.middlewares[EMiddlewareType.ON_REGISTER]) {
			let {$eventName, $callback} = md(eventName, callback);
			if ($eventName) eventName = $eventName;
			if ($callback) callback = $callback;
		}

		if (this.registeredCallbacks[eventName]) throw new Error(`Callback for ${eventName} has already been registered.`);

		this.registeredCallbacks[eventName] = callback;
	}

	private async _setupIncomingPacketHandler(packet: IRequestPacketUnwrapped) {
		let shouldBreak = false;
		let nPacket = undefined;
		let $break = () => {
			shouldBreak = false;
		};

		for (let md of this.middlewares[EMiddlewareType.ON_RECEIVE]) {
			nPacket = await md($break, createRespondPacket, packet);
			if (nPacket) packet = nPacket;
			if (shouldBreak) {
				this.socket.emit(packet.id, packet);
				return
			}
		}

		if (packet.from !== 'server') {
			this.socket.emit(`${packet.id}`, createRespondPacket(packet.id, false, '500', null));
			return
		}

		if (!this.registeredCallbacks[packet.eventName]) {
			this.socket.emit(`${packet.id}`, createRespondPacket(packet.id, false, `There is no ${packet.eventName} handler`, null));
			return
		}

		let resultPacket;
		try {
			const res: any = await this.registeredCallbacks[packet.eventName](...packet.args);
			resultPacket = createRespondPacket(packet.id, true, null, res);
			this.socket.emit(`${packet.id}`, resultPacket)
		} catch (e) {
			resultPacket = createRespondPacket(packet.id, false, e.message, null);
			this.socket.emit(`${packet.id}`, resultPacket)
		} finally {
			for (let md of this.middlewares[EMiddlewareType.AFTER_RECEIVE_CALLBACK]) {
				await md(resultPacket);
			}
		}
	}
}
