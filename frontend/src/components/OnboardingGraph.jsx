import { useMemo, useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Custom node component for Obsidian-style appearance
function OnboardingNode({ data, selected }) {
  const isExpanded = data.isExpanded
  const isMainNode = data.isMainNode
  const isSubNode = data.isSubNode

  return (
    <div
      className={`
        relative rounded-xl transition-all duration-300 cursor-pointer
        ${isMainNode ? 'min-w-[200px]' : 'min-w-[160px]'}
        ${selected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900' : ''}
        ${isExpanded ? 'scale-105' : ''}
      `}
      style={{
        background: isSubNode
          ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
          : isExpanded
          ? 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)'
          : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        boxShadow: isExpanded
          ? '0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(139, 92, 246, 0.2)'
          : isSubNode
          ? '0 4px 20px rgba(99, 102, 241, 0.3)'
          : '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !border-purple-300 !w-3 !h-3"
      />

      <div className={`${isMainNode ? 'p-4' : 'p-3'}`}>
        {/* Step indicator */}
        {isMainNode && data.stepNumber && (
          <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-purple-600 border-2 border-purple-300 flex items-center justify-center text-xs font-bold text-white shadow-lg">
            {data.stepNumber}
          </div>
        )}

        {/* File name */}
        <div className={`font-semibold text-white ${isMainNode ? 'text-sm' : 'text-xs'} mb-1 flex items-center gap-2`}>
          <span className="truncate">{data.label}</span>
          {isMainNode && data.hasChildren && (
            <span className={`text-purple-300 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
              {isExpanded ? '−' : '+'}
            </span>
          )}
        </div>

        {/* Summary */}
        {isMainNode && (
          <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
            {data.summary}
          </div>
        )}

        {/* Sub-node type indicator */}
        {isSubNode && data.type && (
          <div className="text-[10px] text-indigo-300 uppercase tracking-wide mt-1">
            {data.type}
          </div>
        )}

        {/* Expand hint */}
        {isMainNode && data.hasChildren && !isExpanded && (
          <div className="mt-2 text-[10px] text-purple-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Click to explore
          </div>
        )}
      </div>

      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !border-purple-300 !w-3 !h-3"
      />

      {/* Side handles for sub-node connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-indigo-500 !border-indigo-300 !w-2 !h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-indigo-500 !border-indigo-300 !w-2 !h-2"
      />
    </div>
  )
}

const nodeTypes = {
  onboarding: OnboardingNode,
}

// Generate positions for vertical linked list layout
function generateLayout(steps, expandedNodes) {
  const nodes = []
  const edges = []
  const mainNodeSpacing = 160
  const subNodeOffsetX = 280
  const subNodeSpacing = 80

  steps.forEach((step, index) => {
    const mainNodeId = step.file
    const isExpanded = expandedNodes.has(mainNodeId)
    const y = index * mainNodeSpacing

    // Generate subNodes from available data if not provided
    let subNodes = step.subNodes || []
    if (subNodes.length === 0) {
      // Generate subNodes from key_exports, responsibilities, or dependencies
      const exports = step.key_exports || []
      const responsibilities = step.responsibilities || []
      const dependencies = step.dependencies || []
      
      // Create subNodes from key exports (functions, classes, etc.)
      exports.slice(0, 5).forEach(exp => {
        subNodes.push({ label: exp, type: 'Export' })
      })
      
      // Add some responsibilities as concepts
      if (subNodes.length < 5 && responsibilities.length > 0) {
        responsibilities.slice(0, 3).forEach(resp => {
          if (!subNodes.find(s => s.label === resp)) {
            subNodes.push({ label: resp, type: 'Responsibility' })
          }
        })
      }
    }

    // Main node (vertical linked list)
    nodes.push({
      id: mainNodeId,
      type: 'onboarding',
      position: { x: 0, y },
      data: {
        label: step.file,
        summary: step.summary,
        stepNumber: index + 1,
        isMainNode: true,
        isExpanded,
        hasChildren: subNodes.length > 0,
        responsibilities: step.responsibilities,
        key_exports: step.key_exports,
      },
    })

    // Edge to next main node
    if (index < steps.length - 1) {
      edges.push({
        id: `main-${index}`,
        source: mainNodeId,
        target: steps[index + 1].file,
        type: 'smoothstep',
        animated: true,
        style: {
          stroke: '#8b5cf6',
          strokeWidth: 2,
        },
      })
    }

    // Sub-nodes when expanded
    if (isExpanded && subNodes.length > 0) {
      subNodes.forEach((subNode, subIndex) => {
        const subNodeId = `${mainNodeId}-sub-${subIndex}`
        const subY = y + (subIndex - (subNodes.length - 1) / 2) * subNodeSpacing

        nodes.push({
          id: subNodeId,
          type: 'onboarding',
          position: { x: subNodeOffsetX, y: subY },
          data: {
            label: subNode.label,
            type: subNode.type,
            isSubNode: true,
            isMainNode: false,
          },
        })

        // Edge from main node to sub-node
        edges.push({
          id: `sub-${mainNodeId}-${subIndex}`,
          source: mainNodeId,
          sourceHandle: 'right',
          target: subNodeId,
          targetHandle: 'left',
          type: 'smoothstep',
          style: {
            stroke: '#6366f1',
            strokeWidth: 1.5,
            strokeDasharray: '5,5',
          },
        })
      })
    }
  })

  return { nodes, edges }
}

export default function OnboardingGraph({ steps, onNodeClick, highlightedFiles }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set())

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => generateLayout(steps || [], expandedNodes),
    [steps, expandedNodes]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when layout changes
  useMemo(() => {
    const { nodes: newNodes, edges: newEdges } = generateLayout(steps || [], expandedNodes)
    setNodes(newNodes)
    setEdges(newEdges)
  }, [steps, expandedNodes, setNodes, setEdges])

  // Apply highlighting
  useMemo(() => {
    if (!highlightedFiles) return
    const highlighted = new Set(highlightedFiles)
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: {
          ...n.style,
          filter: highlighted.has(n.id) ? 'brightness(1.3)' : undefined,
        },
      }))
    )
  }, [highlightedFiles, setNodes])

  const handleNodeClick = useCallback(
    (_, node) => {
      if (node.data.isMainNode && node.data.hasChildren) {
        setExpandedNodes((prev) => {
          const next = new Set(prev)
          if (next.has(node.id)) {
            next.delete(node.id)
          } else {
            next.add(node.id)
          }
          return next
        })
      }
      onNodeClick?.(node.id)
    },
    [onNodeClick]
  )

  if (!steps || steps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-50">🧭</div>
          <div>No onboarding path available</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={{ background: '#0f0a1f' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background
          color="#2d1f5c"
          gap={30}
          size={1.5}
          style={{ backgroundColor: '#0f0a1f' }}
        />
        <Controls
          className="!bg-[#09090b] !border !border-zinc-800 !rounded-lg !shadow-lg [&>button]:!bg-[#09090b] [&>button]:!border-zinc-800 [&>button]:!fill-zinc-500 [&>button:hover]:!fill-zinc-300"
          style={{}}
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm border border-purple-900/50 rounded-lg p-3 text-xs text-slate-400">
        <div className="font-medium text-purple-400 mb-2">Navigation</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-purple-600 border border-purple-300" />
          <span>Main learning step</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded bg-indigo-800 border border-indigo-500" />
          <span>Related concept</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span>Click node to expand</span>
        </div>
      </div>
    </div>
  )
}
