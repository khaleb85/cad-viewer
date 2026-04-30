import { AcApFontMapping } from './AcApSettingManager'

/**
 * Baked-in font substitutions ("acad.fmp digital") applied automatically
 * by the viewer when a DWG references a font that is not directly available
 * in `fonts.json`. The mapping is merged with any user-provided mapping at
 * the point of use, with the user's mapping winning on conflict.
 *
 * The keys cover four categories:
 *  - SHX legacy/3rd-party names (Arch family, stylus, country, etc.)
 *  - Autodesk SHX→TTF aliases (e.g. `txt_____` → `txt`)
 *  - PostScript legacy names → modern equivalents
 *  - Asian big-font alternative names (`@simsun` → `simsun`)
 *
 * Lookup is case-sensitive on the consumer side, so we register both the
 * original casing and lowercase where the field is observed in the wild.
 */
export const DEFAULT_FONT_MAPPING: AcApFontMapping = {
  // -- SHX 3rd-party / arch / handwriting --
  arch: 'simplex',
  archd: 'simplex',
  architxt: 'simplex',
  archquik: 'simplex',
  'ARCH-SS': 'simplex',
  ArchF: 'simplex',
  ArchS: 'simplex',
  ArchT: 'simplex',
  Archstyl: 'simplex',
  Archstyl04: 'simplex',
  Archisel: 'simplex',
  stylus: 'romans',
  STYLUS: 'romans',
  StylusBT: 'romans',
  country: 'simplex',
  cordia: 'simplex',
  leroy: 'romans',
  MLeroy: 'romans',
  vertical: 'romans',
  ENGINEER: 'simplex',
  // -- Autodesk SHX→TTF naming --
  txt_____: 'txt',
  simplex_: 'simplex',
  romans__: 'romans',
  romanc__: 'romanc',
  romand__: 'romand',
  romant__: 'romant',
  isocp___: 'isocp',
  isocp__: 'isocp',
  italicc_: 'italic',
  italict_: 'italict',
  gothicg_: 'gothicg',
  gothice_: 'gothice',
  gothici_: 'gothici',
  scripts_: 'scripts',
  scriptc_: 'scriptc',
  symath__: 'symath',
  symap___: 'symap',
  symeteo_: 'symeteo',
  syastro_: 'syastro',
  isocpeur: 'isocp',
  isocteur: 'isoct',
  // -- PostScript legacy → modern --
  CIBT: 'arial',
  CITYB: 'arial',
  COBT: 'arial',
  COUNB: 'arial',
  EUR: 'arial',
  EURR: 'arial',
  EURO: 'arial',
  EURRO: 'arial',
  PAR: 'romans',
  PANROMAN: 'romans',
  ROM: 'romans',
  ROMANTIC: 'romans',
  ROMB: 'romans',
  ROMAB: 'romans',
  ROMI: 'italic',
  ROMAI: 'italic',
  SAS: 'arial',
  SANSS: 'arial',
  SASB: 'arial',
  SANSSB: 'arial',
  SASBO: 'arial',
  SANSSBO: 'arial',
  SASO: 'arial',
  SANSSO: 'arial',
  SUF: 'arial',
  SUPEF: 'arial',
  // -- Asian big-font aliases --
  '@simsun': 'simsun',
  '@simhei': 'simhei',
  '@simkai': 'simkai',
  '@chineset': 'chineset',
  // -- Common Brazilian/engineering DWG TextStyle names that point to nowhere --
  Standard: 'simplex',
  STANDARD: 'simplex',
  AaBb123: 'simplex'
}
