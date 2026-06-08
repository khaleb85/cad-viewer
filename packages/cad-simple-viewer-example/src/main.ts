import {
  AcApDocManager,
  AcApOpenDatabaseOptions,
  AcApSettingManager,
  AcEdOpenMode,
  AcEdSelectionEventArgs
} from '@mlightcad/cad-simple-viewer'
import {
  AcDbDatabase,
  acdbHostApplicationServices,
  AcDbObjectId,
  AcDbUnitsValue
} from '@mlightcad/data-model'

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

type CadPropertyType =
  | 'array'
  | 'string'
  | 'int'
  | 'float'
  | 'enum'
  | 'color'
  | 'transparency'
  | 'layer'
  | 'linetype'
  | 'lineweight'
  | 'boolean'

interface CadPropertyItem {
  label: string;
  value: string;
  rawValue: number | string | boolean | null;
  propertyType: CadPropertyType;
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

interface CadDocumentUnits {
  insunits: number;
  insunitsName: string;
  measurement: 'imperial' | 'metric';
  unitSuffix: string;
}

interface CadSelectionData {
  entities: CadSelectedEntity[];
  count: number;
  units: CadDocumentUnits;
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
              const isActive = layout.blockTableRecordId === currentSpaceId

              let hasEntities = false
              const btr = db.tables.blockTable.getIdAt(
                layout.blockTableRecordId
              )
              if (btr) {
                for (const _entity of btr.newIterator()) {
                  hasEntities = true
                  break
                }
              }

              // mantém o layout ativo mesmo se vazio, pra nunca ficar sem seleção
              if (!hasEntities && !isActive) continue

              layouts.push({
                name: layout.layoutName,
                tabOrder: layout.tabOrder,
                isActive
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
          getSelectedEntitiesProperties: (): CadSelectionData | null => {
            return this.buildSelectionData()
          },
          /**
           * @deprecated Use getSelectedEntitiesProperties() instead.
           */
          getSelectedEntityProperties: (): CadSelectedEntity | null => {
            const data = this.buildSelectionData()
            return data?.entities[data.entities.length - 1] ?? null
          },
          formatLength: (value: number): string => {
            const db = AcApDocManager.instance.curDocument?.database
            if (!db) return String(value)
            return this.formatLengthSafe(db, value)
          },
          getDocumentUnits: (): CadDocumentUnits | null => {
            const db = AcApDocManager.instance.curDocument?.database
            if (!db) return null
            return this.getDocumentUnits(db)
          }
        }

        this.isInitialized = true
      } catch (error) {
        console.error('Failed to initialize CAD viewer:', error)
      }
    }
  }

  private buildSingleEntityData(
    db: AcDbDatabase,
    id: AcDbObjectId
  ): CadSelectedEntity | null {
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
          properties.push(this.buildPropertyItem(db, prop))
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
          this.makeFallbackItem('Tipo', entity.type, 'string'),
          this.makeFallbackItem('Layer', entity.layer, 'layer'),
          this.makeFallbackItem(
            'Cor',
            entity.color?.toString() ?? '',
            'color'
          ),
          this.makeFallbackItem('Tipo de Linha', entity.lineType ?? '', 'linetype'),
          this.makeFallbackItem(
            'Espessura',
            entity.lineWeight ?? null,
            'lineweight'
          )
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildPropertyItem(db: AcDbDatabase, prop: any): CadPropertyItem {
    const propertyType: CadPropertyType = (prop.type ?? 'string') as CadPropertyType
    let rawValue: number | string | boolean | null = null
    let value = ''

    try {
      const raw = prop.accessor?.get()
      if (raw !== undefined && raw !== null) {
        if (typeof raw === 'object') {
          // Color and other object-shaped values fall back to a CSS / string repr
          if ('cssColor' in raw && typeof raw.cssColor === 'string') {
            value = raw.cssColor
            rawValue = raw.cssColor
          } else if (typeof raw.toString === 'function') {
            value = String(raw)
            rawValue = value
          } else {
            value = ''
            rawValue = null
          }
        } else if (typeof raw === 'number') {
          rawValue = raw
          value =
            propertyType === 'float' || propertyType === 'int'
              ? this.formatLengthSafe(db, raw)
              : String(raw)
        } else if (typeof raw === 'boolean') {
          rawValue = raw
          value = raw ? 'True' : 'False'
        } else {
          rawValue = String(raw)
          value = String(raw)
        }
      }
    } catch {
      value = ''
      rawValue = null
    }

    return {
      label: prop.name,
      value,
      rawValue,
      propertyType
    }
  }

  private makeFallbackItem(
    label: string,
    raw: number | string | boolean | null,
    propertyType: CadPropertyType
  ): CadPropertyItem {
    return {
      label,
      value: raw === null || raw === undefined ? '' : String(raw),
      rawValue: raw,
      propertyType
    }
  }

  private formatLengthSafe(db: AcDbDatabase, value: number): string {
    try {
      return db.formatter.formatLength(value, { showUnits: true })
    } catch {
      return String(value)
    }
  }

  private getDocumentUnits(db: AcDbDatabase): CadDocumentUnits {
    const insunits = db.insunits
    const insunitsName = AcDbUnitsValue[insunits] ?? 'Undefined'
    const measurement: 'imperial' | 'metric' =
      db.measurement === 1 ? 'metric' : 'imperial'

    let unitSuffix = ''
    try {
      const sample = db.formatter.formatLength(1, { showUnits: true })
      // strip leading numeric / sign / fractional parts; keep the unit chars
      unitSuffix = sample.replace(/^[\s\d.,'"+-/]+/, '').trim()
    } catch {
      unitSuffix = ''
    }

    return {
      insunits,
      insunitsName,
      measurement,
      unitSuffix
    }
  }

  private buildSelectionData(ids?: AcDbObjectId[]): CadSelectionData | null {
    const db = AcApDocManager.instance.curDocument?.database
    if (!db) return null

    let resolvedIds = ids
    if (!resolvedIds) {
      const view = AcApDocManager.instance.curView
      if (!view) return null
      resolvedIds = view.selectionSet.ids
    }

    const units = this.getDocumentUnits(db)

    if (!resolvedIds || resolvedIds.length === 0) {
      return {
        entities: [],
        count: 0,
        units
      }
    }

    const entities: CadSelectedEntity[] = []
    for (const id of resolvedIds) {
      const entity = this.buildSingleEntityData(db, id)
      if (entity) entities.push(entity)
    }

    return {
      entities,
      count: entities.length,
      units
    }
  }

  private emitSelectionChanged(data: CadSelectionData | null) {
    const payload = data ?? {
      entities: [],
      count: 0,
      units: this.getEmptyUnits()
    }
    window.dispatchEvent(
      new CustomEvent('cad-selection-changed', {
        detail: {
          entities: payload.entities,
          count: payload.count,
          units: payload.units,
          // legacy field — first entity only (or null)
          entity: payload.entities[0] ?? null
        }
      })
    )
  }

  private getEmptyUnits(): CadDocumentUnits {
    const db = AcApDocManager.instance.curDocument?.database
    return db
      ? this.getDocumentUnits(db)
      : {
          insunits: 0,
          insunitsName: 'Undefined',
          measurement: 'metric',
          unitSuffix: ''
        }
  }

  private setupSelectionEvents() {
    const view = AcApDocManager.instance.curView
    if (!view) return

    const events = view.selectionSet.events

    events.selectionAdded.addEventListener((_args: AcEdSelectionEventArgs) => {
      this.emitSelectionChanged(this.buildSelectionData())
    })

    events.selectionRemoved.addEventListener(() => {
      this.emitSelectionChanged(this.buildSelectionData())
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
        mode,
        // Override line weight display setting to false so that line weights are not displayed by default
        sysVars: {
          lwdisplay: false
        }
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
