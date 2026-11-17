import { useEffect, useRef, useState } from 'react'
import { Badge, Card, StatCard, go } from '../components/ui'
import PointsExplorer from '../components/PointsExplorer'
import { formatDateTime, binColor, materialName } from '../data/demoData'
import { loadModel, classify, buildResult } from '../lib/vision'

export function CitizenHome({ user, history, stats, onNotify }) {
  const mine = history.filter((h) => h.user === user.name).slice(0, 3)
  return (
    <div className="stack">
      <div>
        <h1>Hola, {user.name.split(' ')[0]} 👋</h1>
        <p className="lead">¿Qué residuo quieres revisar hoy?</p>
      </div>
      <div className="cta">
        <div>
          <strong>Escanear un residuo</strong>
          <p>Abre la cámara o sube una foto y recibe una clasificación estimada con visión por computador.</p>
        </div>
        <button className="btn btn--accent btn--lg" onClick={() => go('/c/scan')}>Escanear residuo</button>
      </div>
      <Card title="Tu actividad" note="Datos de ejemplo. ¡Cada escaneo cuenta para aprender a separar mejor!">
        <div className="stats stats--5">
          <StatCard label="Escaneos totales" value={stats.total} />
          <StatCard label="Este mes" value={stats.month} />
          <StatCard label="Resultados reciclables" value={stats.recyclable} />
          <StatCard label="A revisar / inciertos" value={stats.review} />
          <StatCard label="Puntos vistos" value={stats.pointsViewed} />
        </div>
      </Card>
      <Card title="Escaneos recientes">
        <ul className="list">
          {mine.map((h) => <HistoryRow key={h.id} h={h} />)}
        </ul>
        <button className="btn btn--outline btn--sm" onClick={() => go('/c/history')}>Ver historial completo</button>
      </Card>
      <Card title="Puntos de reciclaje" note="Explora el mapa de puntos de ejemplo; los de Providencia aparecen destacados.">
        <button className="btn btn--outline" onClick={() => go('/c/map')}>Abrir mapa</button>
      </Card>
    </div>
  )
}

function HistoryRow({ h }) {
  return (
    <li className="row-item">
      <div>
        <strong>{h.material}</strong>
        <div className="muted">{formatDateTime(h.date)}{h.isNew ? ' · Nuevo' : ''}</div>
      </div>
      <Badge>{h.status}</Badge>
    </li>
  )
}

export function ScanPage({ points, atPointId, setAtPointId, onScan }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cam, setCam] = useState('starting') // starting | live | denied | unsupported
  const [facing, setFacing] = useState('environment')
  const [captured, setCaptured] = useState(null) // URL de la imagen en análisis
  const [busy, setBusy] = useState(false)
  const [model, setModel] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')

  // Precarga el modelo mientras se muestra la cámara
  const warm = () => { setModel('loading'); loadModel().then(() => setModel('ready'), () => setModel('error')) }
  useEffect(warm, [])

  // La cámara se abre al entrar a la pestaña y se apaga al salir o al capturar
  useEffect(() => {
    if (captured) return
    if (!navigator.mediaDevices?.getUserMedia) { setCam('unsupported'); return }
    let cancelled = false
    setCam('starting')
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        setCam('live')
      })
      .catch(() => { if (!cancelled) setCam('denied') })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing, captured])

  async function analyze(source, url) {
    setError('')
    setCaptured(url)
    setBusy(true)
    try {
      const preds = await classify(source)
      onScan(buildResult(preds), url, atPointId)
    } catch {
      setError('No se pudo analizar la imagen. El modelo de visión necesita conexión a internet la primera vez que se usa.')
      setModel('error')
      setBusy(false)
    }
  }
  function capture() {
    const v = videoRef.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    analyze(c, c.toDataURL('image/jpeg', 0.85))
  }
  async function fromGallery(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // La imagen se procesa en el navegador; no se sube ni se guarda.
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.src = url
    try { await img.decode() } catch { setError('No se pudo leer la imagen seleccionada.'); return }
    analyze(img, url)
  }
  const retake = () => { setCaptured(null); setBusy(false); setError('') }
  const activePoints = points.filter((p) => p.status === 'Active')

  return (
    <div className="stack">
      <h1>Escanear residuo</h1>
      <div className="stage">
        {captured ? (
          <img src={captured} alt="Imagen en análisis" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted aria-label="Vista de la cámara" />
        )}
        {!captured && cam === 'starting' && <div className="stage__msg" role="status">Abriendo cámara…</div>}
        {!captured && cam === 'denied' && <div className="stage__msg" role="alert">No se pudo acceder a la cámara. Permite el acceso en tu navegador o sube una foto desde la galería.</div>}
        {!captured && cam === 'unsupported' && <div className="stage__msg" role="alert">Este navegador no permite usar la cámara. Sube una foto desde la galería.</div>}
        {busy && <div className="preview__loading" role="status"><span className="spinner" />{model === 'loading' ? 'Cargando modelo de visión…' : 'Analizando residuo…'}</div>}
      </div>

      {captured && !busy ? (
        <div className="row">
          <button className="btn btn--primary" onClick={retake}>Volver a la cámara</button>
        </div>
      ) : (
        <div className="camctl">
          <label className="btn btn--outline">
            Subir desde la galería
            <input type="file" accept="image/*" onChange={fromGallery} hidden disabled={busy} />
          </label>
          <button className="shutter" onClick={capture} disabled={cam !== 'live' || busy} aria-label="Capturar y analizar" />
          <button className="btn btn--outline" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} disabled={cam !== 'live'}>Cambiar cámara</button>
        </div>
      )}
      {error && <p className="notice" role="alert">{error}</p>}

      <Card title="¿Estás en un punto de reciclaje?" note="Si eliges el punto, te indicaremos en qué contenedor (por color) va cada material según su configuración.">
        <label className="field">
          <span className="sr">Punto de reciclaje actual</span>
          <select value={atPointId || ''} onChange={(e) => setAtPointId(e.target.value || null)}>
            <option value="">No, estoy en otro lugar</option>
            {activePoints.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.municipality}</option>)}
          </select>
        </label>
        <p className="small muted" style={{ margin: 0 }}>Ubicaciones de demostración. EcoScan no usa tu ubicación real.</p>
      </Card>

      <p className="small muted">
        {model === 'loading' && 'Modelo de visión: cargando (solo la primera vez, requiere conexión)…'}
        {model === 'ready' && 'Modelo de visión listo. La imagen se analiza en tu dispositivo y no se envía a ningún servidor.'}
        {model === 'error' && <>No se pudo cargar el modelo de visión. <button className="linkbtn" onClick={warm}>Reintentar</button></>}
      </p>
    </div>
  )
}

export function ScanResult({ scan, points, onFind, onOpenPoint, onNotify }) {
  const [fb, setFb] = useState(null)
  const { result: r, preview, pointId } = scan
  const atPoint = points.find((p) => p.id === pointId)
  const accepted = atPoint && atPoint.status === 'Active' && atPoint.acceptedMaterialIds.includes(r.materialId)
  const bin = accepted ? binColor(atPoint.binColors?.[r.materialId]) : null
  const near = points
    .filter((p) => p.status === 'Active' && p.acceptedMaterialIds.some((id) => r.acceptedMaterialIds.includes(id)))
    .sort((a, b) => (b.municipality === 'Providencia') - (a.municipality === 'Providencia'))
    .slice(0, 3)
  const tone = r.confidence >= 85 ? 'ok' : r.confidence >= 60 ? 'warn' : 'err'

  const feedback = (kind) => {
    setFb(kind)
    onNotify(kind === 'ok' ? 'Gracias por tu opinión (simulada: no se envió nada).' : 'Reporte registrado de forma simulada: no se envió nada.')
  }

  return (
    <div className="stack">
      <h1>Resultado del escaneo</h1>
      <p className="notice">Resultado estimado por un modelo de visión (MobileNet) que se ejecuta en tu navegador. Puede equivocarse y la imagen no sale de tu dispositivo.</p>
      <Card>
        <div className="result">
          <img src={preview} alt="Imagen analizada" />
          <div>
            <p className="muted">Categoría probable</p>
            <h2 className="result__mat">{r.material}</h2>
            <p className="muted">{r.category}</p>
            <Badge>{r.resultStatus}</Badge>
          </div>
        </div>
        <div className="confidence">
          <div className="confidence__top"><span>Confianza del modelo</span><strong>{r.confidence}%</strong></div>
          <div className={'meter meter--' + tone} role="meter" aria-label="Confianza del modelo" aria-valuemin="0" aria-valuemax="100" aria-valuenow={r.confidence}><span style={{ width: r.confidence + '%' }} /></div>
        </div>
      </Card>
      {atPoint && (
        <Card title={`Contenedor en ${atPoint.name}`} className="card--bin">
          {bin ? (
            <div className="bin">
              <span className="bin__color" style={{ background: bin.hex }} aria-hidden="true" />
              <div><strong>Deposítalo en el contenedor {bin.label.toLowerCase()}</strong><div className="muted">{r.material} · según la configuración de este punto</div></div>
            </div>
          ) : r.acceptedMaterialIds.length === 0 ? (
            <p>Este material no tiene contenedor de reciclaje asignado. Sigue las instrucciones de abajo.</p>
          ) : atPoint.acceptedMaterialIds.includes(r.materialId) ? (
            <p>El punto tiene {materialName(r.materialId).toLowerCase()} configurado, pero no está activo ahora.</p>
          ) : (
            <p>Este punto <strong>no acepta</strong> {materialName(r.materialId).toLowerCase()}. Revisa los puntos sugeridos más abajo.</p>
          )}
          <p className="small muted" style={{ margin: '.5rem 0 0' }}>Configuración de ejemplo de demostración.</p>
        </Card>
      )}
      <Card title="Observación de contaminación visible" className={r.visibleContamination ? 'card--warn' : ''}>
        <p><strong>{r.condition}.</strong> {r.contaminationNote}</p>
        <p className="small muted">Una imagen no permite detectar contaminantes ocultos.</p>
        {r.modelLabel && <p className="small muted" style={{ margin: 0 }}>Etiqueta detectada por el modelo: «{r.modelLabel}».</p>}
      </Card>
      <Card title="Cómo prepararlo" note={r.recommendation}>
        <ol className="instr">{r.instructions.map((i) => <li key={i}>{i}</li>)}</ol>
      </Card>
      <Card title="Puntos de reciclaje sugeridos">
        {near.length === 0 ? (
          <p className="empty">No hay puntos sugeridos para este resultado. Consulta la guía local de disposición.</p>
        ) : (
          <ul className="list">
            {near.map((p) => (
              <li key={p.id} className="row-item">
                <div><strong>{p.name}</strong><div className="muted">{p.municipality} · {p.openingHours}</div></div>
                <button className="btn btn--outline btn--sm" onClick={() => onOpenPoint(p.id)}>Ver punto</button>
              </li>
            ))}
          </ul>
        )}
        <p className="demo-note">Ubicaciones de demostración — no son instalaciones operativas verificadas.</p>
      </Card>
      <Card title="¿Te fue útil este resultado?">
        <div className="row">
          <button className={'btn ' + (fb === 'ok' ? 'btn--primary' : 'btn--outline')} onClick={() => feedback('ok')} aria-pressed={fb === 'ok'}>👍 Útil</button>
          <button className={'btn ' + (fb === 'issue' ? 'btn--primary' : 'btn--outline')} onClick={() => feedback('issue')} aria-pressed={fb === 'issue'}>Reportar un problema</button>
        </div>
        {fb && <p className="confirm" role="status">{fb === 'ok' ? '✓ ¡Gracias! Tu valoración quedó registrada solo en esta demo.' : '✓ Tu reporte quedó registrado solo en esta demo. No se envió a ningún servidor.'}</p>}
      </Card>
      <div className="row">
        <button className="btn btn--primary" onClick={() => onFind(r.acceptedMaterialIds[0])}>Encontrar un punto de reciclaje</button>
        <button className="btn btn--outline" onClick={() => go('/c/scan')}>Escanear otro objeto</button>
      </div>
    </div>
  )
}

export function ScanHistory({ user, history }) {
  const mine = history.filter((h) => h.user === user.name)
  return (
    <div className="stack">
      <h1>Historial de escaneos</h1>
      <DemoNoteLine />
      <Card>
        <ul className="list">
          {mine.map((h) => (
            <li key={h.id} className="row-item">
              <div>
                <strong>{h.material}</strong>
                <div className="muted">{formatDateTime(h.date)} · Confianza {h.confidence}%{h.isNew ? ' · Nuevo' : ''}</div>
              </div>
              <Badge>{h.status}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <button className="btn btn--primary" onClick={() => go('/c/scan')}>Escanear residuo</button>
    </div>
  )
}
const DemoNoteLine = () => <p className="demo-note">Historial de ejemplo; los escaneos nuevos se guardan solo mientras dure esta sesión.</p>

export function CitizenMap({ points, focus, onView }) {
  return (
    <div className="stack">
      <h1>Puntos de reciclaje</h1>
      <p className="lead">Filtra por material y revisa horarios y materiales aceptados. Los puntos de Providencia aparecen destacados.</p>
      <PointsExplorer points={points} emphasize="Providencia" focus={focus} onView={onView} />
    </div>
  )
}
