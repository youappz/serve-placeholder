import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { createApp } from 'h3'
import { listen } from 'listhen'
import { fetch } from 'ohmyfetch'
import { servePlaceholder } from '../src'
import { defaultOptions } from '../src/defaults'

describe('basic', () => {
  let app, listener, _fetch

  beforeAll(async () => {
    app = createApp()
    app.use('/test', () => 'Works!')
    app.use(servePlaceholder({}))
    listener = await listen(app, { port: 0 })
    _fetch = url => fetch(listener.url + url)
  })

  afterAll(async () => {
    await listener.close()
  })

  it('/test', async () => {
    const res = await _fetch('test')
    expect(await res.text()).toBe('Works!')
  })

  it('Headers', async () => {
    const res = await _fetch(listener.url + '404.json')
    expect(Object.fromEntries(res.headers.entries())).toMatchObject({
      'cache-control': 'no-cache, no-store, must-revalidate',
      connection: 'close',
      'content-length': '2',
      'content-type': 'application/json',
      expires: '0',
      pragma: 'no-cache'
    })
  })

  // Test all handlers
  const handlersToTest = Object.entries(defaultOptions.handlers).map(([ext, handler]) => ({ ext, handler }))
  handlersToTest.push({ ext: '.unknown', handler: 'default ' })
  for (const { ext, handler } of handlersToTest) {
    it('Handler for ' + ext, async () => {
      const res = await _fetch(listener.url + `assets/foo${ext}`)
      const placeholder = defaultOptions.placeholders[handler]
      if (placeholder instanceof Buffer) {
        expect(await res.buffer().then(r => r.data)).toMatchObject(defaultOptions.placeholders[handler].data)
      } else {
        expect(await res.text()).toMatchObject(defaultOptions.placeholders[handler] || '')
      }
    })
  }
})

describe('skipUnknown', () => {
  let app, listener, _fetch

  beforeAll(async () => {
    app = createApp()
    app.use('/test', () => 'Works!')
    app.use(servePlaceholder({
      skipUnknown: true,
      noCache: false,
      handlers: {
        '.skipme': false
      }
    }))
    app.use('/', () => 'Unknown!')
    listener = await listen(app, { port: 0 })
    _fetch = url => fetch(listener.url + url)
  })

  afterAll(async () => {
    await listener.close()
  })

  it('/test', async () => {
    const res = await _fetch('test')
    expect(await res.text()).toBe('Works!')
  })

  it.todo('/foo?bar.map', async () => {
    const res = await _fetch('/foo?bar.map')
    expect(await res.text()).toBe('Unknown!')
  })

  it('Headers', async () => {
    const res = await _fetch('/404.json')
    const resHeaders = Object.fromEntries(res.headers.entries())
    expect(resHeaders).toMatchObject({
      connection: 'close',
      'content-length': '2',
      'content-type': 'application/json'
    })
    for (const header of ['cache-control', 'expires', 'pragma']) {
      expect(resHeaders[header]).toBeUndefined()
    }
  })

  it.todo('.skipme', async () => {
    const res = await _fetch('/assets/foo.skipme')
    expect(await res.text()).toBe('Unknown!')
  })

  it('unknown', async () => {
    const res = await _fetch('/assets/foo.unknown')
    expect(await res.text()).toBe('Unknown!')
  })
})
