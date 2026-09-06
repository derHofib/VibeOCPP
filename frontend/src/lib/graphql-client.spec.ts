import { vi } from 'vitest';

const requestMock = vi.fn();
vi.mock('graphql-request', () => ({
  GraphQLClient: class {
    request = requestMock;
  },
}));

const subscribeMock = vi.fn().mockReturnValue(() => {});
const createClientMock = vi.fn().mockReturnValue({ subscribe: subscribeMock });
vi.mock('graphql-ws', () => ({
  createClient: createClientMock,
}));

const { graphqlRequest, configureGraphqlClient, subscribe, __resetWsClientForTests } = await import(
  './graphql-client.js'
);

describe('graphqlRequest', () => {
  beforeEach(() => {
    requestMock.mockClear();
    configureGraphqlClient({ getAccessToken: () => null });
  });

  it('sends no Authorization header when there is no access token', async () => {
    requestMock.mockResolvedValue({ ok: true });
    await graphqlRequest('query { ok }');
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestHeaders: undefined }),
    );
  });

  it('attaches a bearer token when one is available', async () => {
    configureGraphqlClient({ getAccessToken: () => 'token-123' });
    requestMock.mockResolvedValue({ ok: true });
    await graphqlRequest('query { ok }', { id: '1' });
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        document: 'query { ok }',
        variables: { id: '1' },
        requestHeaders: { Authorization: 'Bearer token-123' },
      }),
    );
  });
});

describe('subscribe', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    subscribeMock.mockClear();
    __resetWsClientForTests();
  });

  it('builds the websocket client with a same-origin url derived from the http path', () => {
    configureGraphqlClient({ getAccessToken: () => null });
    subscribe({ query: 'subscription { x }' }, { next: () => {} });

    expect(createClientMock).toHaveBeenCalledOnce();
    const options = createClientMock.mock.calls[0][0];
    expect(options.url).toMatch(/^wss?:\/\/.+\/hasura\/v1\/graphql$/);
  });

  it('resolves connectionParams to a Hasura-style headers object carrying the bearer token', async () => {
    configureGraphqlClient({ getAccessToken: () => 'ws-token' });
    subscribe({ query: 'subscription { x }' }, { next: () => {} });

    const options = createClientMock.mock.calls[0][0];
    await expect(options.connectionParams()).resolves.toEqual({
      headers: { Authorization: 'Bearer ws-token' },
    });
  });

  it('resolves connectionParams to an empty object when there is no token', async () => {
    configureGraphqlClient({ getAccessToken: () => null });
    subscribe({ query: 'subscription { x }' }, { next: () => {} });

    const options = createClientMock.mock.calls[0][0];
    await expect(options.connectionParams()).resolves.toEqual({});
  });

  it('only builds one websocket client across multiple subscriptions', () => {
    configureGraphqlClient({ getAccessToken: () => null });
    subscribe({ query: 'subscription { a }' }, { next: () => {} });
    subscribe({ query: 'subscription { b }' }, { next: () => {} });

    expect(createClientMock).toHaveBeenCalledOnce();
    expect(subscribeMock).toHaveBeenCalledTimes(2);
  });

  it('forwards only result.data to next, and passes through error/complete', () => {
    configureGraphqlClient({ getAccessToken: () => null });
    const next = vi.fn();
    const error = vi.fn();
    const complete = vi.fn();
    subscribe({ query: 'subscription { x }' }, { next, error, complete });

    const sink = subscribeMock.mock.calls[0][1];
    sink.next({ data: { x: 1 } });
    sink.next({ data: null });
    sink.error(new Error('boom'));
    sink.complete();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ x: 1 });
    expect(error).toHaveBeenCalledWith(expect.any(Error));
    expect(complete).toHaveBeenCalledOnce();
  });
});
