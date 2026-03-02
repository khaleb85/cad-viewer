import {
  AcApDocManager,
  AcApSettingManager
} from '@mlightcad/cad-simple-viewer'
import { AcDbOpenDatabaseOptions } from '@mlightcad/data-model'

class CadViewerApp {
  private container: HTMLDivElement
  private toolbarZoomButton?: HTMLButtonElement
  private toolbarZoomWindowButton?: HTMLButtonElement
  private toolbarBgButton?: HTMLButtonElement
  private isInitialized: boolean = false
  private hasLoadedDocument: boolean = false

  constructor() {
    this.container = document.getElementById('cad-container') as HTMLDivElement

    this.loadFile('<!FILE_NAME!>', '<!FILE_URL!>')
    this.setupToolbarActions()
    this.updateToolbarButtonsState()
  }

  private initialize() {
    if (!this.isInitialized) {
      try {
        AcApSettingManager.instance.isShowToolbar = true
        AcApSettingManager.instance.isShowCommandLine = false
        AcApSettingManager.instance.isShowCoordinate = true

        AcApDocManager.createInstance({
          container: this.container,
          autoResize: true,
          baseUrl: '<!BASE_URL!>',
          webworkerFileUrls: {
            mtextRender: '/workers/mtext-renderer-worker.js',
            dxfParser: '/workers/dxf-parser-worker.js',
            dwgParser: '/workers/libredwg-parser-worker.js'
          }
        })

        AcApDocManager.instance.events.documentActivated.addEventListener(
          args => {
            document.title = args.doc.docTitle
          }
        )

        this.isInitialized = true
      } catch (error) {
        console.error('Failed to initialize CAD viewer:', error)
      }
    }
  }

  private setupToolbarActions() {
    const toolbarContainer = document.createElement('div')
    toolbarContainer.className = 'toolbar-container'

    const zoomFitButton = document.createElement('button')
    zoomFitButton.className = 'toolbar-button'
    zoomFitButton.id = 'toolbarZoomButton'
    zoomFitButton.textContent = 'Zoom Fit'

    const zoomWindowButton = document.createElement('button')
    zoomWindowButton.className = 'toolbar-button'
    zoomWindowButton.id = 'toolbarZoomWindowButton'
    zoomWindowButton.textContent = 'Zoom to Window'

    const bgButton = document.createElement('button')
    bgButton.className = 'toolbar-button'
    bgButton.id = 'toolbarBgButton'
    bgButton.textContent = 'Switch BG'

    toolbarContainer.appendChild(zoomFitButton)
    toolbarContainer.appendChild(zoomWindowButton)
    toolbarContainer.appendChild(bgButton)

    this.container.appendChild(toolbarContainer)

    this.toolbarZoomButton = document.getElementById(
      'toolbarZoomButton'
    ) as HTMLButtonElement
    this.toolbarZoomWindowButton = document.getElementById(
      'toolbarZoomWindowButton'
    ) as HTMLButtonElement
    this.toolbarBgButton = document.getElementById(
      'toolbarBgButton'
    ) as HTMLButtonElement

    this.toolbarZoomButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      AcApDocManager.instance.sendStringToExecute('zoom')
    })

    this.toolbarZoomWindowButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      AcApDocManager.instance.sendStringToExecute('zoomw')
    })

    this.toolbarBgButton.addEventListener('click', () => {
      if (!this.hasLoadedDocument || !this.isInitialized) {
        return
      }
      AcApDocManager.instance.sendStringToExecute('switchbg')
    })
  }

  private async loadFile(fileName: string, fileUrl: string) {
    this.initialize()

    try {
      const res = await fetch(fileUrl)
      const blob = await res.blob()

      const fileContent = await this.readBlob(blob)
      const options: AcDbOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        readOnly: true
      }

      const success = await AcApDocManager.instance.openDocument(
        fileName,
        fileContent,
        options
      )

      if (success) {
        this.onFileOpened()
        console.log(`Successfully loaded: ${fileName}`)
      } else {
        console.error(`Failed to load: ${fileName}`)
      }
    } catch (error) {
      console.error(`Error loading file: ${error}`)
    }
  }

  private onFileOpened() {
    this.hasLoadedDocument = true
    this.updateToolbarButtonsState()
  }

  private updateToolbarButtonsState() {
    if (this.toolbarZoomButton) {
      this.toolbarZoomButton.disabled = !this.hasLoadedDocument
    }
    if (this.toolbarZoomWindowButton) {
      this.toolbarZoomWindowButton.disabled = !this.hasLoadedDocument
    }
    if (this.toolbarBgButton) {
      this.toolbarBgButton.disabled = !this.hasLoadedDocument
    }
  }

  private readBlob(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CadViewerApp()
  })
} else {
  new CadViewerApp()
}
