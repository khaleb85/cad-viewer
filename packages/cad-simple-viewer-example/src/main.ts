import {
  AcApDocManager,
  AcApOpenDatabaseOptions,
  AcApSettingManager,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer'

class CadViewerApp {
  private container: HTMLDivElement
  private isInitialized: boolean = false

  constructor() {
    this.container = document.getElementById('cad-container') as HTMLDivElement
    this.loadFile('<!FILE_NAME!>', '<!FILE_URL!>')
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

        // Expose command API for host application (e.g. Coordly React)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).cadExec = (cmd: string) =>
          AcApDocManager.instance.sendStringToExecute(cmd)

        this.isInitialized = true
      } catch (error) {
        console.error('Failed to initialize CAD viewer:', error)
      }
    }
  }

  private async loadFile(fileName: string, fileUrl: string) {
    this.initialize()

    try {
      const res = await fetch(fileUrl)
      const blob = await res.blob()

      const fileContent = await this.readBlob(blob)
      const mode = this.resolveMode('<!VIEWER_MODE!>')
      const options: AcApOpenDatabaseOptions = {
        minimumChunkSize: 1000,
        mode
      }

      const success = await AcApDocManager.instance.openDocument(
        fileName,
        fileContent,
        options
      )

      if (success) {
        console.log(`Successfully loaded: ${fileName}`)
        window.dispatchEvent(new CustomEvent('cad-file-loaded'))
      } else {
        console.error(`Failed to load: ${fileName}`)
      }
    } catch (error) {
      console.error(`Error loading file: ${error}`)
    }
  }

  private resolveMode(modeStr: string): AcEdOpenMode {
    switch (modeStr) {
      case 'write':
        return AcEdOpenMode.Write
      case 'review':
        return AcEdOpenMode.Review
      default:
        return AcEdOpenMode.Read
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
