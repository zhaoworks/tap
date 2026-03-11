import { describe, expect, it } from 'bun:test';

import { Tap } from '../src/index';

describe('Tap', () => {
  it('should handle GET requests', async () => {
    const mock = new Tap();
    
    mock.get('/users', (req, reply) => {
      return reply.json({ users: [] });
    });
    
    const response = await mock.fetch('http://api.example.com/users');
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toEqual({ users: [] });
  });

  it('should handle route parameters', async () => {
    const mock = new Tap();
    
    mock.get('/users/:id', (req, reply) => {
      return reply.json({ id: req.params.id });
    });
    
    const response = await mock.fetch('http://api.example.com/users/123');
    const data = await response.json();
    
    expect(data.id).toBe('123');
  });

  it('should handle query parameters', async () => {
    const mock = new Tap();
    
    mock.get('/search', (req, reply) => {
      const query = req.query.get('q');
      return reply.json({ query });
    });
    
    const response = await mock.fetch('http://api.example.com/search?q=test');
    const data = await response.json();
    
    expect(data.query).toBe('test');
  });

  it('should handle POST with JSON body', async () => {
    const mock = new Tap();
    
    mock.post('/users', (req, reply) => {
      return reply.status(201, { 
        id: 'new-id',
        ...req.body as object
      });
    });
    
    const response = await mock.fetch('http://api.example.com/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });
    
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data.name).toBe('John');
  });

  it('should handle custom headers', async () => {
    const mock = new Tap();
    
    mock.get('/test', (req, reply) => {
      return reply
        .header('x-custom', 'value')
        .json({ success: true });
    });
    
    const response = await mock.fetch('http://api.example.com/test');
    
    expect(response.headers.get('x-custom')).toBe('value');
  });

  it('should return 404 for unmatched routes', async () => {
    const mock = new Tap();
    
    const response = await mock.fetch('http://api.example.com/not-found');
    
    expect(response.status).toBe(404);
  });

  it('should handle errors in handlers', async () => {
    const mock = new Tap();
    
    mock.get('/error', () => {
      throw new Error('Test error');
    });
    
    const response = await mock.fetch('http://api.example.com/error');
    
    expect(response.status).toBe(500);
  });

  it('should support method chaining', async () => {
    const mock = new Tap();
    
    mock
      .get('/users', (req, reply) => reply.json({ method: 'GET' }))
      .post('/users', (req, reply) => reply.json({ method: 'POST' }));
    
    const getResponse = await mock.fetch('http://api.example.com/users');
    const getData = await getResponse.json();
    expect(getData.method).toBe('GET');
    
    const postResponse = await mock.fetch('http://api.example.com/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const postData = await postResponse.json();
    expect(postData.method).toBe('POST');
  });

  it('should clear routes', async () => {
    const mock = new Tap();
    
    mock.get('/test', (req, reply) => reply.json({ success: true }));
    
    let response = await mock.fetch('http://api.example.com/test');
    expect(response.status).toBe(200);
    
    mock.clear();
    
    response = await mock.fetch('http://api.example.com/test');
    expect(response.status).toBe(404);
  });

  it('should list registered routes', () => {
    const mock = new Tap();
    
    mock
      .get('/users', (req, reply) => reply.json([]))
      .post('/users', (req, reply) => reply.json({}))
      .get('/users/:id', (req, reply) => reply.json({}));
    
    const routes = mock.getRoutes();
    
    expect(routes.length).toBe(3);
    expect(routes[0].method).toBe('GET');
    expect(routes[0].path).toBe('/users');
    expect(routes[1].method).toBe('POST');
    expect(routes[2].path).toBe('/users/:id');
  });

  it('should handle nested route parameters', async () => {
    const mock = new Tap();
    
    mock.get('/orgs/:orgId/projects/:projectId', (req, reply) => {
      return reply.json({
        orgId: req.params.orgId,
        projectId: req.params.projectId,
      });
    });
    
    const response = await mock.fetch(
      'http://api.example.com/orgs/org-123/projects/proj-456'
    );
    const data = await response.json();
    
    expect(data.orgId).toBe('org-123');
    expect(data.projectId).toBe('proj-456');
  });

  it('should resolve relative requests using baseURL', async () => {
    const mock = new Tap({ baseURL: 'http://api.example.com' });

    mock.get('/users', (req, reply) => reply.json({ ok: true }));

    const response = await mock.fetch('/users');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('should pass through non-baseURL requests with passthrough.fetch', async () => {
    const passthroughFetch = async () => {
      return new Response(JSON.stringify({ proxied: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    };

    const mock = new Tap({
      baseURL: 'http://api.example.com',
      passthrough: {
        enabled: true,
        fetch: passthroughFetch,
      },
    });

    const response = await mock.fetch('https://other.example.com/health');
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.proxied).toBe(true);
  });

  it('should throw for non-baseURL requests without passthrough enabled', async () => {
    const mock = new Tap({ baseURL: 'http://api.example.com' });

    await expect(mock.fetch('https://other.example.com/health')).rejects.toThrow(
      'No passthrough configured'
    );
  });

  it('should default passthrough.fetch to globalThis.fetch', async () => {
    const originalFetch = globalThis.fetch;
    const stubFetch = async () => {
      return new Response(JSON.stringify({ proxied: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    };

    globalThis.fetch = stubFetch as unknown as typeof fetch;

    try {
      const mock = new Tap({
        baseURL: 'http://api.example.com',
        passthrough: {
          enabled: true,
        },
      });

      const response = await mock.fetch('https://other.example.com/health');
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.proxied).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should restrict passthrough to allowed URLs when passthrough.allow is set', async () => {
    const passthroughFetch = async () => {
      return new Response(JSON.stringify({ proxied: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    };

    const mock = new Tap({
      baseURL: 'http://api.example.com',
      passthrough: {
        enabled: true,
        fetch: passthroughFetch,
        allow: ['https://other.example.com/allowed'],
      },
    });

    const allowedResponse = await mock.fetch('https://other.example.com/allowed/resource');
    expect(allowedResponse.status).toBe(202);

    await expect(mock.fetch('https://other.example.com/blocked')).rejects.toThrow(
      'No passthrough configured'
    );
  });

  it('should allow all passthrough requests when allow contains wildcard', async () => {
    const passthroughFetch = async () => {
      return new Response(JSON.stringify({ proxied: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    };

    const mock = new Tap({
      baseURL: 'http://api.example.com',
      passthrough: {
        enabled: true,
        fetch: passthroughFetch,
        allow: ['*'],
      },
    });

    const response = await mock.fetch('https://any.example.com/blocked');
    expect(response.status).toBe(202);
  });

  it('should register all HTTP methods with all()', async () => {
    const mock = new Tap();

    mock.all('/status', (req, reply) => reply.json({ method: req.method }));

    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

    for (const method of methods) {
      const response = await mock.fetch('http://api.example.com/status', { method });
      expect(response.status).toBe(200);
    }
  });

  it('should parse form-urlencoded body', async () => {
    const mock = new Tap();

    mock.post('/form', (req, reply) => {
      const params = req.body as URLSearchParams;
      return reply.json({ name: params.get('name') });
    });

    const response = await mock.fetch('http://api.example.com/form', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Alice',
    });

    const data = await response.json();
    expect(data.name).toBe('Alice');
  });
});
