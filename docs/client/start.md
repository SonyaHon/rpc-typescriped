---
book: Client  
chapter: Setting up
---

# Client setting up
## Installation
Just install an npm module via
```
npm i --save @so-net/rpc sokcet.io socket.io-client socket.io-msgpack-parser
```
## Setting up connection
You should already have a server, than you can do following
```js
import ioClient from 'socket.io-client' // Or get io client code in any other way
import {Client} from '@so-net/rpc/api.web'
import parser from 'socket.io-msgpack-parser'

const api = new Client({socket: ioClient({parser})})

// basically you are ready
```
