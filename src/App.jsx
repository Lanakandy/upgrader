import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowRight, Loader2 } from 'lucide-react';

// --- 1. API SERVICE ---
const upgradeText = async (text, mode, context) => {
  try {
    const response = await fetch("/.netlify/functions/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mode, context })
    });

    if (!response.ok) throw new Error("Netlify Function failed");

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error(error);
    return { text: "Connection error.", reason: "Try again later." };
  }
};

// --- 2. CUSTOM NODE COMPONENT ---
const PaperNode = ({ data, id }) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (mode) => {
    setLoading(true);
    // Passing reason directly prevents stale state issues
    await data.onUpgrade(id, data.text, data.reason, mode);
    setLoading(false);
  };

  return (
    <div className="relative group w-[350px]">
      <div className="absolute top-2 left-2 w-full h-full bg-white border border-ink z-0"></div>
      <div className="absolute top-1 left-1 w-full h-full bg-white border border-ink z-10"></div>
      <div className="relative bg-white border border-ink p-6 z-20 transition-all font-serif">
        <Handle type="target" position={Position.Top} className="!bg-ink !w-2 !h-2" />
        <div className="mb-4 text-lg leading-relaxed text-ink">{data.text}</div>
        <div className="border-t border-dotted border-ink pt-3 flex gap-2 flex-wrap">
           {loading ? (
             <div className="flex items-center text-xs font-mono gap-2">
               <Loader2 className="animate-spin w-3 h-3" /> PHILOLOGIZING...
             </div>
           ) : (
             <>
               <button onClick={() => handleUpgrade('sophisticate')} className="px-2 py-1 bg-grid-bg border border-ink text-xs font-mono hover:bg-yellow-200 transition-colors">↑ ELEVATE</button>
               <button onClick={() => handleUpgrade('simplify')} className="px-2 py-1 bg-grid-bg border border-ink text-xs font-mono hover:bg-yellow-200 transition-colors">↓ GROUND</button>
               <button onClick={() => handleUpgrade('emotional')} className="px-2 py-1 bg-grid-bg border border-ink text-xs font-mono hover:bg-yellow-200 transition-colors">→ EMOTION</button>
             </>
           )}
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-ink !w-2 !h-2" />
      </div>
    </div>
  );
};

const nodeTypes = { paper: PaperNode };

// --- 3. MAIN APP ---
export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [inputText, setInputText] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  // Helper to add a new node
  const handleUpgradeRequest = useCallback(async (parentId, parentText, parentReason, mode) => {
    
    // 1. Call API
    const result = await upgradeText(parentText, mode, parentReason);
    const newNodeId = `${Date.now()}`;

    // 2. Functional update for Nodes
    setNodes((currentNodes) => {
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return currentNodes;

      // --- DIRECTIONAL LOGIC START ---
      // We assume the card is roughly 350px wide and 200px tall
      let dx = 0;
      let dy = 0;
      const VERTICAL_GAP = 400;
      const HORIZONTAL_GAP = 450;
      const JITTER = (Math.random() * 60) - 30; // Adds randomness to prevent perfect overlapping

      switch (mode) {
        case 'sophisticate': // UP (North)
          dx = JITTER; 
          dy = -VERTICAL_GAP; 
          break;
        case 'simplify': // DOWN (South)
          dx = JITTER;
          dy = VERTICAL_GAP;
          break;
        case 'emotional': // RIGHT (East) - expansion
        case 'action':    
          dx = HORIZONTAL_GAP;
          dy = JITTER; 
          break;
        default: // Fallback (Down)
          dx = JITTER;
          dy = VERTICAL_GAP;
      }

      const newPos = { 
        x: parentNode.position.x + dx, 
        y: parentNode.position.y + dy 
      };
      // --- DIRECTIONAL LOGIC END ---

      const newNode = {
        id: newNodeId,
        type: 'paper',
        position: newPos,
        data: { 
          text: result.text, 
          reason: result.reason,
          onUpgrade: handleUpgradeRequest 
        },
      };
      return [...currentNodes, newNode];
    });

    // 3. Add Edge
    setEdges((currentEdges) => {
       const newEdge = {
        id: `e${parentId}-${newNodeId}`,
        source: parentId,
        target: newNodeId,
        type: 'default', // 'straight' or 'smoothstep' also look good with this layout
        label: result.reason, 
        labelStyle: { fill: '#1a1a1a', fontFamily: 'Times New Roman', fontStyle: 'italic', fontSize: 12 },
        labelBgStyle: { fill: '#F9F6C8', fillOpacity: 0.9, stroke: '#1a1a1a', strokeDasharray: '2,2' },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 10,
        style: { stroke: '#1a1a1a', strokeDasharray: '5,5', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#1a1a1a' },
      };
      return [...currentEdges, newEdge];
    });

  }, []);

  const startSession = () => {
    if(!inputText) return;
    setHasStarted(true);
    setNodes([
      {
        id: '1',
        type: 'paper',
        position: { x: window.innerWidth / 2 - 175, y: 100 },
        data: { text: inputText, onUpgrade: handleUpgradeRequest },
      },
    ]);
  };

  return (
    <div className="w-screen h-screen font-serif text-ink relative">
      
      {/* HEADER UI */}
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex justify-between items-start pointer-events-none">
        <div>
          <h1 className="text-4xl font-serif tracking-tight pointer-events-auto">Upgrader</h1>
          <p className="font-mono text-xs mt-1 bg-white border border-ink inline-block px-2 py-1 pointer-events-auto">
             {nodes.length} NODES CREATED
          </p>
        </div>
      </div>

      {/* START SCREEN MODAL */}
      {!hasStarted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-grid-bg/90 backdrop-blur-sm">
          <div className="bg-white border border-ink p-8 shadow-hard max-w-lg w-full">
            <h2 className="text-2xl mb-4">Plant your seed.</h2>
            <textarea
              className="w-full h-32 border border-ink p-4 font-serif text-lg focus:outline-none resize-none mb-4 bg-gray-50"
              placeholder="Type a phrase you want to evolve... e.g. 'I am very hungry'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button 
              onClick={startSession}
              disabled={!inputText}
              className="w-full bg-ink text-white py-3 font-mono hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              INITIALIZE GRID <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* CANVAS */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-grid-bg"
      >
        <Background color="#d1cfaa" gap={24} size={1.5} />
        <Controls className="!bg-white !border !border-ink !shadow-hard !text-ink !rounded-none" />
      </ReactFlow>
    </div>
  );
}