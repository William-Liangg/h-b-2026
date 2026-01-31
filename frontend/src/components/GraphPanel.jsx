import { useMemo, useCallback, useState } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const EXT_COLORS = {
  '.py': '#3b82f6',
  '.js': '#eab308',
  '.jsx': '#eab308',
  '.ts': '#2563eb',
  '.tsx': '#2563eb',
  '.go': '#06b6d4',
  '.rs': '#f97316',
  '.java': '#ef4444',
  '.rb': '#dc2626',
  '.vue': '#22c55e',
  '.svelte': '#f97316',
  '.css': '#a855f7',
  '.scss': '#a855f7',
  '.html': '#f97316',
  '.json': '#6b7280',
  '.md': '#6b7280',
}

function layoutNodes(apiNodes) {
  const dirs = {}
  apiNodes.forEach((n) => {
    const parts = n.id.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    if (!dirs[dir]) dirs[dir] = []
    dirs[dir].push(n)
  })

  const nodes = []
  let col = 0
  for (const dir of Object.keys(dirs).sort()) {
    const files = dirs[dir]
    files.forEach((n, row) => {
      const score = n.importance_score || 0
      const size = Math.max(10, score)
      const padding = score >= 8 ? '10px 16px' : '6px 12px'
      const fontSize = score >= 8 ? 13 : 12
      nodes.push({
        id: n.id,
        position: { x: col * 240, y: row * 70 },
        data: {
          label: n.label,
          summary: n.summary || '',
          importance_score: score,
          onboarding_reason: n.onboarding_reason || '',
          fullPath: n.id,
        },
        style: {
          background: EXT_COLORS[n.extension] || '#475569',
          color: '#fff',
          border: score >= 8 ? '2px solid rgba(255,255,255,0.3)' : 'none',
          borderRadius: 8,
          padding,
          fontSize,
          fontWeight: score >= 8 ? 600 : 500,
          opacity: score >= 6 ? 1 : 0.7,
        },
      })
    })
    col++
  }
  return nodes
}

function Tooltip({ node, position }) {
  if (!node) return null
  const { summary, importance_score, onboarding_reason, fullPath } = node.data
  if (!summary) return null

  return (
    <div
      className="absolute z-50 max-w-xs p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-xs pointer-events-none"
      style={{ left: position.x + 12, top: position.y - 8 }}
    >
      <div className="font-medium text-cyan-400 mb-1 truncate">{fullPath}</div>
      <div className="text-slate-300 mb-2">{summary}</div>
      {onboarding_reason && (
        <div className="text-slate-500 italic">{onboarding_reason}</div>
      )}
      <div className="mt-1 text-slate-600">Importance: {importance_score}/10</div>
    </div>
  )
}

export default function GraphPanel({ data, highlightedFiles, onNodeClick }) {
  const [hoveredNode, setHoveredNode] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const initialNodes = useMemo(() => (data ? layoutNodes(data.nodes) : []), [data])
  const initialEdges = useMemo(
    () =>
      data
        ? data.edges.map((e, i) => ({
            id: `e-${i}`,
            source: e.source,
            target: e.target,
            style: { stroke: '#475569' },
            animated: false,
          }))
        : [],
    [data]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useMemo(() => {
    if (!data) return
    const highlighted = new Set(highlightedFiles)
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          boxShadow: highlighted.has(n.id) ? '0 0 0 3px #22d3ee, 0 0 20px #22d3ee55' : 'none',
          transform: highlighted.has(n.id) ? 'scale(1.1)' : 'scale(1)',
        },
      }))
    )
  }, [highlightedFiles, data, setNodes])

  const handleNodeClick = useCallback(
    (_, node) => onNodeClick?.(node.id),
    [onNodeClick]
  )

  const handleNodeMouseEnter = useCallback((event, node) => {
    const bounds = event.currentTarget.closest('.react-flow').getBoundingClientRect()
    setMousePos({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
    setHoveredNode(node)
  }, [])

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [])

  if (!data) return <div className="h-full flex items-center justify-center text-slate-600">No graph data</div>

  return (
    <div className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls />
      </ReactFlow>
      <Tooltip node={hoveredNode} position={mousePos} />
    </div>
  )
}
