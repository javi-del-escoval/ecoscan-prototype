// Visión por computador gratuita: MobileNet (TensorFlow.js) se ejecuta en el navegador.
// No hay servidor, clave de API ni envío de imágenes. Los pesos del modelo se descargan
// la primera vez que se usa (requiere conexión).
import { scanResults } from '../data/demoData'

let modelPromise
export function loadModel() {
  modelPromise ??= (async () => {
    const [tf, mobilenet] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/mobilenet')])
    await tf.ready()
    return mobilenet.load({ version: 2, alpha: 1.0 })
  })().catch((e) => { modelPromise = null; throw e })
  return modelPromise
}

// MobileNet usa las 1000 clases de ImageNet; solo algunas se relacionan con residuos.
// Palabras clave (en inglés, como las devuelve el modelo) -> material de EcoScan.
const KEYWORDS = {
  PET: ['water bottle', 'pop bottle', 'soda bottle', 'water jug', 'pill bottle'],
  HDPE: ['soap dispenser', 'lotion', 'plastic bag', 'hair spray', 'detergent'],
  GLASS: ['beer bottle', 'wine bottle', 'red wine', 'beer glass', 'goblet', 'perfume', 'vase', 'whiskey jug'],
  ALU: ['milk can', 'cocktail shaker', 'tin can', 'beer can'],
  PAPER: ['carton', 'envelope', 'paper towel', 'notebook', 'book jacket', 'menu', 'binder', 'packet', 'toilet tissue'],
  ORGANIC: ['banana', 'orange', 'lemon', 'strawberry', 'pineapple', 'granny smith', 'fig', 'pomegranate', 'broccoli', 'cauliflower', 'cucumber', 'cabbage', 'mushroom', 'bell pepper', 'zucchini', 'artichoke', 'custard apple', 'jackfruit', 'corn', 'acorn squash'],
}
const MIN_PROB = 0.12

export function mapPredictions(preds) {
  for (const p of preds) {
    const name = p.className.toLowerCase()
    for (const [materialId, words] of Object.entries(KEYWORDS)) {
      if (words.some((w) => name.includes(w)) && p.probability >= MIN_PROB) return { materialId, prob: p.probability, label: p.className }
    }
  }
  const top = preds[0]
  return { materialId: 'UNKNOWN', prob: top?.probability ?? 0, label: top?.className ?? '' }
}

export function buildResult(preds) {
  const { materialId, prob, label } = mapPredictions(preds)
  const base = scanResults.find((r) => r.materialId === materialId) ?? scanResults.find((r) => r.materialId === 'UNKNOWN')
  const confidence = Math.round(prob * 100)
  const lowConf = materialId !== 'UNKNOWN' && confidence < 40
  let resultStatus = base.resultStatus
  if (materialId === 'PAPER' || materialId === 'GLASS' || materialId === 'ALU' || materialId === 'PET' || materialId === 'HDPE') resultStatus = 'Reciclable'
  if (lowConf) resultStatus = 'Incierto'
  return {
    ...base,
    confidence,
    modelLabel: label,
    resultStatus,
    condition: 'Condición no evaluada',
    visibleContamination: false,
    contaminationNote: 'El modelo solo identifica el tipo de objeto; no evalúa suciedad ni contaminación. Revisa tú mismo que el envase esté vacío y limpio.',
    recommendation: materialId === 'UNKNOWN'
      ? 'EcoScan no reconoce este objeto como un material reciclable con suficiente confianza.'
      : lowConf ? 'Confianza baja: confirma el material antes de depositarlo.' : base.recommendation,
  }
}

export async function classify(source) {
  // Gancho solo para pruebas en desarrollo (se elimina del build de producción)
  if (import.meta.env.DEV && window.__mockPreds) return window.__mockPreds
  const model = await loadModel()
  return model.classify(source, 8)
}
