jest.mock('../src/util/AcApFontUtil', () => ({
  AcApFontUtil: { getReplacementFontName: () => 'arial' }
}))

import type { AcApDocManager } from '../src/app/AcApDocManager'
import { AcApNotificationEventBridge } from '../src/app/notification/AcApNotificationEventBridge'
import { AcApNotificationStore } from '../src/app/notification/AcApNotificationStore'
import { eventBus } from '../src/editor/global/eventBus'

function makeDocManager(sessionId: string, missedFonts: string[] = []) {
  const event = { addEventListener: jest.fn(), removeEventListener: jest.fn() }
  return {
    activeSessionId: sessionId,
    curView: {
      missedData: {
        fonts: Object.fromEntries(missedFonts.map(name => [name, 1]))
      }
    },
    events: {
      documentToBeOpened: event,
      documentCreated: event,
      documentActivated: event,
      documentToBeDestroyed: event
    }
  } as unknown as AcApDocManager
}

describe('AcApNotificationEventBridge missing fonts', () => {
  let bridge: AcApNotificationEventBridge
  let store: AcApNotificationStore

  beforeEach(() => {
    store = new AcApNotificationStore()
    store.setActiveSession('doc-1')
    bridge = new AcApNotificationEventBridge(
      makeDocManager('doc-1'),
      () => store
    )
    bridge.install()
  })

  afterEach(() => bridge.uninstall())

  it('keeps a single warning listing every missing font', () => {
    eventBus.emit('font-not-found', { fontName: 'Arial_B', count: 1 })
    eventBus.emit('font-not-found', { fontName: 'Arial_B_1', count: 1 })
    eventBus.emit('fonts-not-found', { fonts: ['GOTHIC'] })

    const warnings = store.notifications.filter(n => n.source === 'font-missed')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].fontNames).toEqual(['Arial_B', 'Arial_B_1', 'GOTHIC'])
  })

  it('does not re-raise the warning for a font already reported', () => {
    eventBus.emit('font-not-found', { fontName: 'Arial_B', count: 1 })
    const firstId = store.notifications[0].id
    eventBus.emit('font-not-found', { fontName: 'Arial_B', count: 3 })

    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe(firstId)
  })
})
