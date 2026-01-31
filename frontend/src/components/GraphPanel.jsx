import { useMemo, useCallback } from 'react'
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
  // Simple grid layout grouped by directory
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
      nodes.push({
        id: n.id,
        position: { x: col * 220, y: row * 60 },
        data: { label: n.label },
        style: {
          background: EXT_COLORS[n.extension] || '#475569',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
        },
      })
    })
    col++
  }
  return nodes
}

export default function GraphPanel({ data, highlightedFiles, onNodeClick }) {
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

  // Update node highlighting
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

  if (!data) return <div className="h-full flex items-center justify-center text-slate-600">No graph data</div>

  return (
    <div className="h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
