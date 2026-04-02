import {
  AcApDocManager,
  AcApOpenDatabaseOptions,
  AcApSettingManager,
  AcEdOpenMode,
  AcEdSelectionEventArgs
} from '@mlightcad/cad-simple-viewer'
import { acdbHostApplicationServices, AcDbObjectId } from '@mlightcad/data-model'

interface CadLayerInfo {
  name: string;
  color: string;
  cssColor: string;
  isOff: boolean;
  isLocked: boolean;
  isHidden: boolean;
  isInUse: boolean;
  isPlottable: boolean;
  linetype: string;
  lineWeight: number;
}

interface CadLayoutInfo {
  name: string;
  tabOrder: number;
  isActive: boolean;
}

interface CadPropertyItem {
  label: string;
  value: string;
  units?: string;
}

interface CadPropertyCategory {
  categoryName: string;
  properties: CadPropertyItem[];
}

interface CadSelectedEntity {
  type: string;
  name?: string;
  layer: string;
  objectId: string;
  categories: CadPropertyCategory[];
}

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

        AcApDocManager.instance.progress.show()

        AcApDocManager.instance.events.documentActivated.addEventListener(
          args => {
            document.title = args.doc.docTitle
          }
        )

        // Expose command API for host application (e.g. Coordly React)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).cadExec = (cmd: string) =>
          AcApDocManager.instance.sendStringToExecute(cmd)
        // Expose viewer instance for host application (e.g. Coordly React)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).viewerInstance = AcApDocManager.instance

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).helpers = {
          switchLayout: (layoutName: string) => {
            acdbHostApplicationServices().layoutManager.setCurrentLayout(layoutName)
          },
          getLayouts: (): CadLayoutInfo[] => {
            const db = acdbHostApplicationServices().workingDatabase
            const layoutDict = db.objects.layout
            const currentSpaceId = db.currentSpaceId

            const layouts: CadLayoutInfo[] = []
            for (const layout of layoutDict.newIterator()) {
              layouts.push({
                name: layout.layoutName,
                tabOrder: layout.tabOrder,
                isActive: layout.blockTableRecordId === currentSpaceId
              })
            }

            return layouts.sort((a, b) => a.tabOrder - b.tabOrder)
          },
          getLayers: (): CadLayerInfo[] => {
            const db = AcApDocManager.instance.curDocument.database
            const layers: CadLayerInfo[] = []

            for (const layer of db.tables.layerTable.newIterator()) {
              layers.push({
                name: layer.name,
                color: layer.color.toString(),
                cssColor: layer.color.cssColor || '#FFFFFF',
                isOff: layer.isOff,
                isLocked: layer.isLocked,
                isHidden: layer.isHidden,
                isInUse: layer.isInUse,
                isPlottable: layer.isPlottable,
                linetype: layer.linetype,
                lineWeight: layer.lineWeight
              })
            }

            return layers.sort((a, b) => a.name.localeCompare(b.name))
          },
          setLayerVisibility: (layerName: string, visible: boolean) => {
            const db = AcApDocManager.instance.curDocument.database
            const layer = db.tables.layerTable.getAt(layerName)
            if (!layer) return

            layer.isOff = !visible
            const view = AcApDocManager.instance.curView
            if (view) {
              view.updateLayer(layer, { isOff: !visible })
            }
            window.dispatchEvent(new CustomEvent('cad-layers-changed'))
          },
          setLayerLock: (layerName: string, locked: boolean) => {
            const db = AcApDocManager.instance.curDocument.database
            const layer = db.tables.layerTable.getAt(layerName)
            if (!layer) return

            layer.isLocked = locked
            window.dispatchEvent(new CustomEvent('cad-layers-changed'))
          },
          getSelectedEntityProperties: (): CadSelectedEntity | null => {
            return this.buildEntityData()
          }
        }

        this.isInitialized = true
      } catch (error) {
        console.error('Failed to initialize CAD viewer:', error)
      }
    }
  }

  private buildEntityData(targetId?: AcDbObjectId): CadSelectedEntity | null {
    const db = AcApDocManager.instance.curDocument?.database
    if (!db) return null

    let id = targetId
    if (!id) {
      const view = AcApDocManager.instance.curView
      if (!view) return null
      const ids: AcDbObjectId[] = view.selectionSet.ids
      if (!ids || ids.length === 0) return null
      id = ids[ids.length - 1]
    }

    const entity = db.tables.blockTable.modelSpace.getIdAt(id)
    if (!entity) return null

    // Use entity.properties API to get full grouped properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (entity as any).properties
    const categories: CadPropertyCategory[] = []

    if (props && props.groups) {
      for (const group of props.groups) {
        const properties: CadPropertyItem[] = []
        for (const prop of group.properties) {
          let value = ''
          try {
            const raw = prop.accessor?.get()
            if (raw !== undefined && raw !== null) {
              if (typeof raw === 'object' && raw.cssColor) {
                value = raw.cssColor
              } else {
                value = String(raw)
              }
            }
          } catch {
            value = ''
          }
          properties.push({
            label: prop.name,
            value
          })
        }
        if (properties.length > 0) {
          categories.push({
            categoryName: group.groupName,
            properties
          })
        }
      }
    }

    // Fallback if entity.properties is not available
    if (categories.length === 0) {
      categories.push({
        categoryName: 'Geral',
        properties: [
          { label: 'Tipo', value: entity.type },
          { label: 'Layer', value: entity.layer },
          { label: 'Cor', value: entity.color?.toString() || '' },
          { label: 'Tipo de Linha', value: entity.lineType || '' },
          { label: 'Espessura', value: String(entity.lineWeight ?? '') }
        ]
      })
    }

    return {
      type: props?.type || entity.type,
      layer: entity.layer,
      objectId: id.toString(),
      categories
    }
  }

  private emitSelectionChanged(entity: CadSelectedEntity | null) {
    window.dispatchEvent(new CustomEvent('cad-selection-changed', {
      detail: { entity }
    }))
  }

  private setupSelectionEvents() {
    const view = AcApDocManager.instance.curView
    if (!view) return

    const events = view.selectionSet.events

    events.selectionAdded.addEventListener((args: AcEdSelectionEventArgs) => {
      const addedIds = args.ids
      const targetId = addedIds && addedIds.length > 0
        ? addedIds[addedIds.length - 1]
        : undefined
      this.emitSelectionChanged(this.buildEntityData(targetId))
    })

    events.selectionRemoved.addEventListener(() => {
      const ids: AcDbObjectId[] = view.selectionSet.ids
      if (!ids || ids.length === 0) {
        this.emitSelectionChanged(null)
      } else {
        this.emitSelectionChanged(this.buildEntityData())
      }
    })
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
        // WORKAROUND: hide Defpoints layer (non-plottable in AutoCAD)
        // Remove when mlightcad/cad-viewer#167 is fixed
        const db = AcApDocManager.instance.curDocument.database
        const defpoints = db.tables.layerTable.getAt('Defpoints')
        if (defpoints && !defpoints.isOff) {
          defpoints.isOff = true
          const view = AcApDocManager.instance.curView
          if (view) {
            view.updateLayer(defpoints, { isOff: true })
          }
        }

        // Setup selection event forwarding after file is loaded
        this.setupSelectionEvents()

        // Listen for layer modifications and forward to host
        db.events.layerModified.addEventListener(() => {
          window.dispatchEvent(new CustomEvent('cad-layers-changed'))
        })

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
