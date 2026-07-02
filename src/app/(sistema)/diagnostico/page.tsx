'use client'

import { useRef, useState } from 'react'

interface Evento {
  texto: string
  ts: number
  deltaDesdeAnterior: number | null
}

export default function DiagnosticoScanner() {
  const [query, setQuery] = useState('')
  const [eventos, setEventos] = useState<Evento[]>([])
  const ultimoTs = useRef<number>(0)

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const ahora = Date.now()
      const delta = ultimoTs.current ? ahora - ultimoTs.current : null
      setEventos(prev => [...prev, { texto: query, ts: ahora, deltaDesdeAnterior: delta }])
      ultimoTs.current = ahora
      setQuery('')
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Diagnóstico de lector de código de barras</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Escaneá UN SOLO producto una sola vez. No toques el teclado. Esta pantalla
        registra cada "Enter" que llega y cuánto tiempo pasó desde el anterior —
        así vemos cuántas transmisiones manda realmente el lector por cada pasada.
      </p>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escaneá acá..."
        style={{
          width: '100%', padding: 12, fontSize: 16, border: '2px solid #00a19a',
          borderRadius: 8, marginBottom: 20, fontFamily: 'monospace',
        }}
      />
      <button
        onClick={() => { setEventos([]); ultimoTs.current = 0 }}
        style={{ padding: '6px 12px', marginBottom: 16, cursor: 'pointer' }}
      >
        Limpiar
      </button>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>#</th>
            <th style={{ padding: 6 }}>Texto recibido</th>
            <th style={{ padding: 6 }}>Hora</th>
            <th style={{ padding: 6 }}>Delta desde el anterior</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((ev, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{i + 1}</td>
              <td style={{ padding: 6 }}>{ev.texto || '(vacío)'}</td>
              <td style={{ padding: 6 }}>{new Date(ev.ts).toLocaleTimeString('es-AR', { hour12: false })}.{ev.ts % 1000}</td>
              <td style={{ padding: 6, fontWeight: ev.deltaDesdeAnterior !== null && ev.deltaDesdeAnterior < 2000 ? 'bold' : 'normal', color: ev.deltaDesdeAnterior !== null && ev.deltaDesdeAnterior < 2000 ? '#c00' : '#333' }}>
                {ev.deltaDesdeAnterior === null ? '—' : `${ev.deltaDesdeAnterior} ms`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {eventos.length === 0 && (
        <p style={{ color: '#999', marginTop: 20 }}>Todavía no se registró ningún escaneo.</p>
      )}
    </div>
  )
}
