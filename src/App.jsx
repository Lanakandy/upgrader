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
  ReactFlowProvider,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowRight, ArrowLeft, Loader2, Copy, Check, Camera, Sparkles, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { diffWords } from 'diff';

// --- 1. API SERVICE ---
const apiCall = async (payload) => {
  try {
    const response = await fetch("/.netlify/functions/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Netlify Function failed");
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error(error);
    return null;
  }
};

// --- 2. PAPER NODE COMPONENT ---
const PaperNode = ({ data, id }) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [definition, setDefinition] = useState(null);

  const handleUpgrade = async (mode, customText = null) => {
    setLoading(true);
    await data.onUpgrade(id, data.text, data.reason, mode, customText);
    setLoading(false);
    setShowCustom(false);
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(data.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWordClick = async (e, word) => {
    e.stopPropagation();
    setDefinition({ word, text: "Analyzing...", nuance: "...", x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    const result = await apiCall({ text: word, context: data.text, task: 'define' });
    if (result) {
      setDefinition(prev => ({ ...prev, text: result.definition, nuance: result.nuance }));
    }
  };

  const renderTextWithDiff = () => {
    if (!data.previousText) {
      return data.text.split(' ').map((word, i) => (
        <span key={i} onClick={(e) => handleWordClick(e, word.replace(/[.,]/g, ''))} className="cursor-pointer hover:bg-yellow-200 hover:text-black rounded px-0.5 transition-colors">
          {word}{' '}
        </span>
      ));
    }
    const diff = diffWords(data.previousText, data.text);
    return diff.map((part, i) => {
      if (part.removed) return null;
      const style = part.added ? "bg-green-100 text-green-900 font-semibold border-b-2 border-green-300" : "text-ink";
      return (
        <span key={i} className={style}>
          {part.value.split(' ').map((word, w) => (
             <span key={w} onClick={(e) => handleWordClick(e, word.replace(/[.,]/g, ''))} className="cursor-pointer hover:bg-yellow-200 rounded px-0.5 transition-colors">
              {word}{' '}
             </span>
          ))}
        </span>
      );
    });
  };

  return (
    <div className="relative group w-[380px]">
      <div className="absolute top-2 left-2 w-full h-full bg-white border border-ink z-0"></div>
      <div className="absolute top-1 left-1 w-full h-full bg-white border border-ink z-10"></div>
      <div className="relative bg-white border border-ink p-6 z-20 transition-all font-serif">
        
        {/* --- HANDLES (UPDATED FOR BIDIRECTIONAL CONNECTIONS) --- */}
        
        {/* TOP */}
        <Handle type="target" id="top" position={Position.Top} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />
        <Handle type="source" id="top-src" position={Position.Top} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />
        
        {/* BOTTOM */}
        <Handle type="source" id="bottom" position={Position.Bottom} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />
        <Handle type="target" id="bottom-tgt" position={Position.Bottom} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />
        
        {/* RIGHT (Added Target) */}
        <Handle type="source" id="right" position={Position.Right} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />
        <Handle type="target" id="right-tgt" position={Position.Right} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />

        {/* LEFT (Added Source) */}
        <Handle type="target" id="left" position={Position.Left} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />
        <Handle type="source" id="left-src" position={Position.Left} className="!bg-ink !w-2 !h-2 opacity-0 group-hover:opacity-100" />


        <button onClick={handleCopy} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-ink transition-colors">
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        </button>

        {definition && (
          <div className="absolute z-50 bg-ink text-white p-3 text-xs w-64 shadow-xl -top-24 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="font-bold text-yellow-200 mb-1 border-b border-gray-600 pb-1">{definition.word}</div>
            <div className="mb-2 leading-tight">{definition.text}</div>
            <div className="italic text-gray-400">"{definition.nuance}"</div>
          </div>
        )}
        {definition && <div className="fixed inset-0 z-40" onClick={() => setDefinition(null)}></div>}

        <div className="mb-4 text-lg leading-relaxed text-ink pr-4">
          {renderTextWithDiff()}
        </div>
        
        <div className="border-t border-dotted border-ink pt-3">
           {loading ? (
             <div className="flex items-center text-xs font-mono gap-2 py-1">
               <Loader2 className="animate-spin w-3 h-3" /> PHILOLOGIZING...
             </div>
           ) : showCustom ? (
             <div className="flex gap-2">
               <input 
                 autoFocus
                 className="flex-1 bg-gray-50 border border-ink px-2 py-1 text-xs font-mono focus:outline-none"
                 placeholder="e.g. Make it sarcastic..."
                 value={customPrompt}
                 onChange={e => setCustomPrompt(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleUpgrade('custom', customPrompt)}
               />
               <button onClick={() => handleUpgrade('custom', customPrompt)} className="px-2 bg-ink text-white text-xs hover:bg-gray-700">GO</button>
               <button onClick={() => setShowCustom(false)} className="px-1 text-ink hover:bg-red-100"><X size={14}/></button>
             </div>
           ) : (
             <div className="flex gap-2 flex-wrap">
               <button onClick={() => handleUpgrade('sophisticate')} className="px-2 py-1 bg-grid-bg border border-ink text-xs font-mono hover:bg-yellow-200 transition-colors">↑ ELEVATE</button>
               <button onClick={() => handleUpgrade('simplify')} className="px-2 py-1 bg-grid-bg border border-ink text-xs font-mono hover:bg-yellow-200 transition-colors">↓ GROUND</button>
               <button onClick={() => handleUpgrade('emotional')} className="px-2 py-1 bg-grid-bg border border-ink text-xs font-mono hover:bg-yellow-200 transition-colors">→ EMOTION</button>
               <button onClick={() => setShowCustom(true)} className="px-2 py-1 bg-white border border-ink border-dashed text-xs font-mono hover:bg-gray-50 transition-colors flex items-center gap-1">
                 <ArrowLeft size={10}/> CUSTOM
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = { paper: PaperNode };

// --- 3. THE CANVAS LOGIC ---
function GridCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [inputText, setInputText] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const { setCenter, getNodes } = useReactFlow();

  const handleDownload = () => {
    const nodesBounds = getNodesBounds(getNodes());
    if (nodesBounds.width === 0 || nodesBounds.height === 0) return;

    const imageWidth = nodesBounds.width + 100;
    const imageHeight = nodesBounds.height + 100;
    
    const transform = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5,
      2,
      50
    );

    const viewport = document.querySelector('.react-flow__viewport');
    
    if (viewport) {
      toPng(viewport, {
        backgroundColor: '#F9F6C8',
        width: imageWidth,
        height: imageHeight,
        style: {
          width: imageWidth,
          height: imageHeight,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        },
      }).then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'upgrade-study-map.png';
        link.href = dataUrl;
        link.click();
      });
    }
  };

  const handleUpgradeRequest = useCallback(async (parentId, parentText, parentReason, mode, customPrompt = null) => {
    
    const result = await apiCall({ text: parentText, mode, context: parentReason, customPrompt });
    if (!result) return;

    const newNodeId = `${Date.now()}`;

    // Directional Logic
    let sourceHandleId = 'bottom'; 
    let targetHandleId = 'top';    
    let calculatedPos = { x: 0, y: 0 };

    setNodes((currentNodes) => {
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return currentNodes;

      let dx = 0; let dy = 0;
      const VERTICAL_GAP = 500;
      const HORIZONTAL_GAP = 750;
      const JITTER = (Math.random() * 60) - 30;

      switch (mode) {
        case 'sophisticate': // UP
          dx = JITTER; dy = -VERTICAL_GAP; 
          sourceHandleId = 'top-src'; targetHandleId = 'bottom-tgt'; 
          break;
        case 'simplify': // DOWN
          dx = JITTER; dy = VERTICAL_GAP;
          sourceHandleId = 'bottom'; targetHandleId = 'top';
          break;
        case 'emotional': // RIGHT
        case 'action':    
          dx = HORIZONTAL_GAP; dy = JITTER; 
          sourceHandleId = 'right'; targetHandleId = 'left';
          break;
        case 'custom': // LEFT
          dx = -HORIZONTAL_GAP; 
          dy = JITTER;
          // FIX: Use the new handle names for correct left-direction lines
          sourceHandleId = 'left-src'; 
          targetHandleId = 'right-tgt'; 
          break;
        default:
          dx = JITTER; dy = VERTICAL_GAP;
      }

      const newPos = { x: parentNode.position.x + dx, y: parentNode.position.y + dy };
      calculatedPos = newPos;

      const newNode = {
        id: newNodeId,
        type: 'paper',
        position: newPos,
        width: 380,
        height: 200,
        data: { 
          text: result.text, 
          reason: result.reason,
          previousText: parentText,
          onUpgrade: handleUpgradeRequest 
        },
      };
      return [...currentNodes, newNode];
    });

    setEdges((currentEdges) => {
       const newEdge = {
        id: `e${parentId}-${newNodeId}`,
        source: parentId, target: newNodeId,
        sourceHandle: sourceHandleId, targetHandle: targetHandleId,
        
        animated: true, // <--- ADD THIS LINE HERE
        
        type: 'default', 
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

    setCenter(calculatedPos.x + 175, calculatedPos.y + 100, { zoom: 1.1, duration: 1200 });

  }, [setCenter]);

  const startSession = () => {
    if(!inputText) return;
    setHasStarted(true);
    const startX = window.innerWidth / 2 - 190;
    const startY = 100;
    
    setNodes([{
        id: '1', type: 'paper',
        position: { x: startX, y: startY },
        width: 380,
        height: 200,
        data: { text: inputText, onUpgrade: handleUpgradeRequest, previousText: null },
      }]);
    
    setCenter(startX + 190, startY + 100, { zoom: 1, duration: 800 });
  };

  return (
    <div className="w-screen h-screen font-serif text-ink relative">
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex justify-between items-start pointer-events-none">
        <div>
          {/* Logo + Title Wrapper */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <img 
              src="/logo.png" 
              alt="Gridscape Logo" 
              className="h-10 w-auto object-contain" 
            />
            <h1 className="text-4xl font-serif tracking-tight">Upgrader</h1>
          </div>
          <p className="font-mono text-xs mt-1 bg-white border border-ink inline-block px-2 py-1 pointer-events-auto">
             {nodes.length} NODES CREATED
          </p>
        </div>
        <button onClick={handleDownload} className="pointer-events-auto bg-white border border-ink p-2 hover:bg-gray-100" title="Download Snapshot">
          <Camera size={20} />
        </button>
      </div>

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

      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
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

export default function App() {
  return (
    <ReactFlowProvider>
      <GridCanvas />
    </ReactFlowProvider>
  );
}