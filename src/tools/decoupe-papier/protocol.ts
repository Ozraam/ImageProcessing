import type { Crop, DecoupeParams } from './render'

export type WorkerRequest =
  | { type: 'source'; blob: Blob | null }
  | { type: 'background'; blob: Blob | null }
  | { type: 'preview'; id: number; params: DecoupeParams; size: number }
  | { type: 'export'; id: number; params: DecoupeParams; size: number; crop: Crop | null }

export type WorkerResponse =
  | { id: number; type: 'preview'; image: ImageBitmap; ms: number }
  | { id: number; type: 'export'; blob: Blob }
  | { id: number; type: 'skipped' }
  | { id: number; type: 'error'; message: string }
