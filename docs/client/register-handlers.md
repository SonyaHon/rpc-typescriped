---
book: Client
chapter: Registering handlers
---

# Registering handlers

```js
api.register('eventName', async (arg1, arg2) => {
	// Your handler code goes here
	return  arg1 + arg2; // return if you need to send amy data to server
})
```
