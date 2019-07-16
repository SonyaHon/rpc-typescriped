---
book: Client
chapter: Using middlewares
---
# Using middlewares

Just like a server client has several types of middlewares:
* `ON_CONNECTION`
* `ON_DISCONNECTION`
* `BEFORE_FIRE`
* `AFTER_FIRE`
* `ON_RECEIVE`
* `AFTER_RECEIVE_CALLBACK`
* `ON_REGISTER`

*Warning:* all middlewares are executed in the order of being used

## `ON_CONNECTION` async/sync
`ON_CONNECTION` middleware is triggered when client socket connects to the server. Reconnections count as well.
Basic syntax to it is as follows
```js
api.use(ON_CONNECTION, async ($break) => {
	// Your code here
})
```
* `$break` - is a function with if this function is called socket will imidiately disconnect from the server. No further middlewares will be executed

## `ON_DISCONNECTION` async/sync
`ON_DISCONNECTION` middleware is triggered when clients disconnects from the server. 
```js
api.use(ON_DISCONNECTION, async () => {
	// Your code here
})
```
Because reconnection is smartly implementated in socket.io this is just an informational/business logic middleware 

## `BEFORE_FIRE` async/sync
`BEFORE_FIRE` middleware is triggered right before firing an event to the server
```js
api.use(BEFORE_FIRE, async ($break, packet) => {
	// your code here
	let res = await getResFromAnotherPlaceSomehow()
	$break(res) // res will be returned  from the api.fire()
})
```
* `$break` - function with res argument. If this function is called, firing is being canceled, as well as execution of all next middlewares.
`$break`. The return of `fire` methods will anything what is in `res` argument
* `packet` - IRequestPacket packet. *DO NOT CHANGE PACKET ID* unless you know what you are doing

The return of this middleware is being passed as a new packet to the next middleware or to the fire event itself

## `AFTER_FIRE` async/sync
`AFTER_FIRE` middleware is triggered after receiving result from server, but before returning it from the function
```js
api.use(AFTER_FIRE, async ($break, result) => {
	// your code here
	let res = await getResFromAnotherPlaceSomehow()
	$break(res) // res will be returned  from the api.fire()
})
```
* `$break` - function with res argument. If this function is called, firing is being canceled, as well as execution of all next middlewares.
`$break`. The return of `fire` methods will anything what is in `res` argument
* `result` - Is the result of executed callback. You can change it before exiting a fire function. Middlewares execution will be continued

## `ON_RECEIVE` async/sync
`ON_RECEIVE` middleware is being triggered when client receives a packet from server, before executing callback
```js
api.use(ON_RECEIVE, async ($break, createRespondPacket, packet) => {
	// your code here
	return  packet;
});
```
* `$break()` - stops execution of following middleware and callback after this, the dummy respond packet will ne fired back to server (which will result in returning undefined on the server) OR if middleware has a return value, this value will be fired as a packet to the server
* `createRespondPacket(id, status, error, res)` - function to create respond packet.
	* `id` - packet.id
	* `status` - weather or not error happened
	* `error` - text of the error or `null` if status is `true`
	* `res` - respond to the server or `null` if status is `false`
* `packet` - packet received by client   
*WARNING:* always return packet from this middleware

## `AFTER_RECEIVE_CALLBACK` async/sync
`AFTER_RECEIVE_CALLBACK` middleware is triggered after the callbacks has been triggered and the result has been already emitted to the server.
```js
api.use(AFTER_RECEIVE_CALLBACK, async (resultPacket) => {
	// your code here
})
```
* `resultPacket` - packet that went to the server

This middleware can not change what is already been fired to the server.
## `ON_REGISTER` sync only
`ON_REGISTER` middleware is triggered when registering new handler
```js
api.use(ON_REGISTER, (eventName, callback) => {
	// your code here
	return {
		$eventName: eventName,
		$callback: callback
	}
})
```
* `eventName` - eventName handler to is being registered
* `callback` - callback to be used as a handler

Return value of this middleware can be an object with `$eventName` (new `eventName`) and `$callback` (new handler function) You can return only one or none of them
