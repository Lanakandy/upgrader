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

const playSound = (type) => {
  const sounds = {
    click: '/soft_click.wav',
    paper: '/paper_rustle.wav',
    write: '/typewriter.wav',
  };
  
  const audio = new Audio(sounds[type]);
  audio.volume = 0.3; // Adjusted volume slightly for local files
  audio.play().catch(e => console.log("Audio interaction needed first"));
};

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
    playSound('write');
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
    playSound('click');
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
      const style = part.added ? "bg-green-100 text-green-900 font-semibold border-b border-green-300" : "text-ink";
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
    <div className="relative group w-[380px] node-enter-anim"> 
      
      <div className="relative bg-white border border-ink p-6 z-20 font-serif
                      shadow-[2px_2px_0px_0px_rgba(26,26,26,0.1)] 
                      group-hover:shadow-[5px_5px_0px_0px_rgba(26,26,26,1)]
                      group-hover:-translate-y-0.5 group-hover:-translate-x-0.5
                      transition-all duration-300 ease-out">
        
        {/* --- HANDLES --- */}
        <Handle type="target" id="top" position={Position.Top} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" id="top-src" position={Position.Top} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <Handle type="source" id="bottom" position={Position.Bottom} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="target" id="bottom-tgt" position={Position.Bottom} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <Handle type="source" id="right" position={Position.Right} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="target" id="right-tgt" position={Position.Right} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />

        <Handle type="target" id="left" position={Position.Left} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Handle type="source" id="left-src" position={Position.Left} className="!bg-ink !w-1.5 !h-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />

        <button onClick={handleCopy} className="absolute top-2 right-2 p-1 hover:bg-yellow-200 transition-colors opacity-50 hover:opacity-100">
          {copied ? <Check size={14} className="text-ink" /> : <Copy size={14} />}
        </button>

        {definition && (
          <div className="absolute z-50 bg-ink text-white p-3 text-xs w-64 shadow-xl -top-24 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="font-bold text-yellow-200 mb-1 border-b border-gray-600 pb-1">{definition.word}</div>
            <div className="mb-2 leading-tight">{definition.text}</div>
            <div className="italic text-gray-400">"{definition.nuance}"</div>
          </div>
        )}
        {definition && <div className="fixed inset-0 z-40" onClick={() => setDefinition(null)}></div>}

        <div className="mb-4 text-xl leading-relaxed text-ink pr-4 selection:bg-yellow-200">
          {renderTextWithDiff()}
        </div>
        
        <div className="border-t border-dotted border-ink/30 pt-4 mt-2">
           {loading ? (
             <div className="flex items-center text-xs font-mono gap-2 py-1 text-gray-500">
               <Loader2 className="animate-spin w-3 h-3" /> ANALYZING TEXTURE...
             </div>
           ) : showCustom ? (
             <div className="flex gap-2">
               <input 
                 autoFocus
                 className="flex-1 bg-gray-50 border-b border-ink px-2 py-1 text-xs font-mono focus:outline-none focus:bg-yellow-50"
                 placeholder="Prompt..."
                 value={customPrompt}
                 onChange={e => setCustomPrompt(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleUpgrade('custom', customPrompt)}
               />
               <button onClick={() => handleUpgrade('custom', customPrompt)} className="px-2 bg-ink text-white text-xs hover:bg-gray-700 font-mono">GO</button>
               <button onClick={() => setShowCustom(false)} className="px-1 text-ink hover:bg-red-100"><X size={14}/></button>
             </div>
           ) : (
             <div className="flex gap-2 flex-wrap items-center">
               <button onClick={() => handleUpgrade('sophisticate')} className="px-3 py-1 bg-transparent border border-ink text-[10px] tracking-widest font-mono font-bold uppercase hover:bg-ink hover:text-white transition-all active:translate-y-0.5">↑ Elevate</button>
               <button onClick={() => handleUpgrade('simplify')} className="px-3 py-1 bg-transparent border border-ink text-[10px] tracking-widest font-mono font-bold uppercase hover:bg-ink hover:text-white transition-all active:translate-y-0.5">↓ Ground</button>
               <button onClick={() => handleUpgrade('emotional')} className="px-3 py-1 bg-transparent border border-ink text-[10px] tracking-widest font-mono font-bold uppercase hover:bg-ink hover:text-white transition-all active:translate-y-0.5">→ Emotion</button>
               
               {/* UPDATED CUSTOM BUTTON WITH TOOLTIP */}
               <button 
                  onClick={() => setShowCustom(true)} 
                  className="relative group/btn px-2 py-1 ml-auto text-ink hover:bg-yellow-200 transition-colors"
                >
                  <Sparkles size={14} className="transition-transform duration-300 group-hover/btn:rotate-90"/>
                  
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full right-0 mb-2 opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap bg-ink text-white text-[10px] font-mono font-bold px-2 py-1 z-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                    CUSTOM PROMPT
  </div>
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
    
    // 1. Get the content from API
    const result = await apiCall({ text: parentText, mode, context: parentReason, customPrompt });
    if (!result) return;

    const newNodeId = `${Date.now()}`;
    let sourceHandleId = 'bottom'; 
    let targetHandleId = 'top';    
    let calculatedPos = { x: 0, y: 0 };

    // 2. Define the ideal spacing
    const VERTICAL_GAP = 400;   // Reduced slightly to keep things tighter
    const HORIZONTAL_GAP = 600; 
    const NODE_WIDTH = 400;     // Width of node (380) + gap
    const NODE_HEIGHT = 250;    // Height of node (approx 200) + gap

    // 3. Determine Direction Vector
    let dx = 0; 
    let dy = 0;
    let directionType = 'vertical'; // 'vertical' or 'horizontal'

    switch (mode) {
      case 'sophisticate': // UP
        dy = -VERTICAL_GAP; 
        sourceHandleId = 'top-src'; targetHandleId = 'bottom-tgt'; 
        directionType = 'vertical';
        break;
      case 'simplify': // DOWN
        dy = VERTICAL_GAP;
        sourceHandleId = 'bottom'; targetHandleId = 'top';
        directionType = 'vertical';
        break;
      case 'emotional': // RIGHT
        dx = HORIZONTAL_GAP; 
        sourceHandleId = 'right'; targetHandleId = 'left';
        directionType = 'horizontal';
        break;
      case 'custom': // LEFT
        dx = -HORIZONTAL_GAP; 
        sourceHandleId = 'left-src'; targetHandleId = 'right-tgt'; 
        directionType = 'horizontal';
        break;
      default:
        dy = VERTICAL_GAP;
    }

    setNodes((currentNodes) => {
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return currentNodes;

      // 4. Calculate Initial Proposed Position
      let candidateX = parentNode.position.x + dx;
      let candidateY = parentNode.position.y + dy;

      // 5. COLLISION DETECTION LOOP
      // We check if any existing node is occupying the candidate spot.
      // If so, we shift the candidate spot until it's free.
      let overlap = true;
      let shiftCount = 0;
      
      while (overlap) {
        overlap = currentNodes.some(n => {
          // Check if a node is within a collision box of the candidate
          const xDiff = Math.abs(n.position.x - candidateX);
          const yDiff = Math.abs(n.position.y - candidateY);
          return xDiff < (NODE_WIDTH - 50) && yDiff < (NODE_HEIGHT - 50);
        });

        if (overlap) {
          shiftCount++;
          // Strategy: If moving Vertically, shift sideways to avoid overlap.
          // If moving Horizontally, shift down.
          if (directionType === 'vertical') {
             // Alternate shifts: Right, then Left, then Right...
             const sign = shiftCount % 2 === 0 ? -1 : 1;
             candidateX += (NODE_WIDTH * sign * Math.ceil(shiftCount/2));
          } else {
             candidateY += NODE_HEIGHT;
          }
        }
      }

      calculatedPos = { x: candidateX, y: candidateY };

      const newNode = {
        id: newNodeId,
        type: 'paper',
        position: calculatedPos, // Use the collision-free position
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
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#1a1a1a', strokeWidth: 2 }, 
        label: result.reason, 
        labelStyle: { fill: '#1a1a1a', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#F9F6C8', stroke: '#1a1a1a', strokeWidth: 1 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 0,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#1a1a1a', width: 20, height: 20 },
      };
      playSound('paper');
      return [...currentEdges, newEdge];
    });

    // Zoom to the new, collision-free position
    // We use a timeout to let React render the node state first
    setTimeout(() => {
       setCenter(calculatedPos.x + 190, calculatedPos.y + 100, { zoom: 1, duration: 1000 });
    }, 100);

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
      
      {/* HEADER UI (Top Left - Title Only) */}
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex justify-between items-start pointer-events-none">
        <div>
          {/* Title restored to text only */}
          <h1 className="text-4xl font-serif tracking-tight pointer-events-auto">Gridsk·i</h1>
          <p className="font-mono text-xs mt-1 bg-white border border-ink inline-block px-2 py-1 pointer-events-auto">
             {nodes.length} NODES CREATED
          </p>
        </div>
        <button onClick={handleDownload} className="pointer-events-auto bg-white border border-ink p-2 hover:bg-gray-100" title="Download Snapshot">
          <Camera size={20} />
        </button>
      </div>

      {/* LOGO UI (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-50 pointer-events-none mix-blend-multiply opacity-80">
        <img 
          src="/logo.png" 
          alt="Gridscape Logo" 
          className="h-16 w-auto object-contain" 
        />
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