###### — @zhaoworks/tap

A fetch adapter designed to provide local request stubs for deterministic tests.

#### Features

- ✅ [Fastify](https://github.com/fastify/fastify)-inspired route registration
- ✅ Route params, query params, headers, and parsed request bodies
- ✅ Native `Request` and `Response` primitives with zero runtime dependencies
- ✅ Drop-in `fetch` replacement for tests and [custom clients](https://github.com/zhaoworks/fetch)
- ✅ Optional `baseURL` and `passthrough` controls for selective mocking

#### Installation

```apache
λ bun add @zhaoworks/tap
```

#### Usage

```ts
import { Tap } from '@zhaoworks/tap';

const tap = new Tap({
  baseURL: 'https://api.example.com',
});

tap
  .get('/users/:id', (request, reply) => {
    return reply.json({
      id: request.params.id,
      search: request.query.get('search'),
    });
  })
  .post('/users', (request, reply) => {
    return reply.status(201, request.body);
  });

const userResponse = await tap.fetch('https://api.example.com/users/123?search=active');
const user = await userResponse.json();

const createResponse = await tap.fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Ada' }),
});

const createdUser = await createResponse.json();
```

###### `Tap` gives each handler a `request` object with `method`, `url`, `headers`, `params`, `query`, and `body`.

```ts
tap.get('/health', (_request, reply) => {
  return reply
    .header('x-mock', 'tap')
    .text('ok');
});
```

###### Use `tap.fetch` anywhere a normal `fetch` function is expected.

```ts
import { HttpClient } from '@zhaoworks/fetch';
import { Tap } from '@zhaoworks/tap';

const tap = new Tap();

tap.get('/api/users', (_request, reply) => {
  return reply.json([{ id: '1', name: 'Ada' }]);
});

const http = new HttpClient({
  endpoint: 'https://api.example.com',
  fetch: tap.fetch,
});

const result = await http.get<Array<{ id: string; name: string }>>('/api/users');

if (result.success) {
  console.log(result.data[0].name);
}
```

### License

[MIT](/LICENSE)
