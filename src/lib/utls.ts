import uuid from 'uuid/v1'

export interface IRequestPacket {
	id: string,
	packet: {
		id: string,
		from: string,
		eventName: string,
		args: []
	}
}

export interface IRequestPacketUnwrapped {
	id: string,
	from: string,
	eventName: string,
	args: []
}

export interface IRespondPacket {
	id: string,
	status: boolean,
	error: string,
	result: any
}

export function createRequestPacket(from: string, eventName: string, args: []): IRequestPacket {
	const id: string = uuid();
	return {
		id,
		packet: {
			id,
			from,
			eventName,
			args
		}
	}
}

export function createRespondPacket(id: string, status: boolean, error: string, result: any): IRespondPacket {
	return {
		id,
		status,
		error,
		result
	}
}


export const CLIENT: string = 'client';
export const SERVER: string = 'server';
export const CLIENT_PACKET: string = 'client-packet';
export const SERVER_PACKET: string = 'server-packet';
