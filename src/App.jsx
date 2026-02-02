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
import { ArrowRight, ArrowLeft, Loader2, Copy, Check, Camera, Sparkles, X, RotateCcw, Mic, PenTool } from 'lucide-react';
import { toPng } from 'html-to-image';
import { diffWords } from 'diff';

// --- SOUND ENGINE ---
const playSound = (type) => {
  const sounds = {
    click: '/soft_click.wav',
    paper: '/paper_rustle.wav',
    write: '/typewriter.wav',
  };
  
  const audio = new Audio(sounds[type]);
  audio.volume = 0.3; 
  audio.play().catch(e => console.log("Audio interaction needed first"));
};

// --- API SERVICE ---
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

// --- PAPER NODE COMPONENT ---
const PaperNode = ({ data, id }) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [definition, setDefinition] = useState(null);
  
  // State for Elevation Level
  const [level, setLevel] = useState(data.initialLevel || 1); 

  const handleUpgrade = async (mode, customText = null) => {
    playSound('write');
    setLoading(true);
    await data.onUpgrade(id, data.text, data.reason, mode, customText, level, data.contextMode);
    setLoading(false);
    setShowCustom(false);
    setCustomPrompt(""); 
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
    setDefinition({ 
      word, 
      text: "Analyzing...", 
      transcription: "...", 
      x: e.nativeEvent.offsetX, 
      y: e.nativeEvent.offsetY 
    });

const result = await apiCall({ text: word, context: data.text, task: 'define' });
    
    if (result) {
      setDefinition(prev => ({ 
        ...prev, 
        text: result.definition, 
        transcription: result.transcription
      }));
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

  // PRESETS FOR CUSTOM MODE
  const CUSTOM_PRESETS = [
    "Sarcastic",
    "Conversational",
    "Journalistic",
    "Scientific"
  ];

  return (
    <div className="relative group w-[480px] node-enter-anim"> 
      
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
            <div className="font-bold text-yellow-200 mb-1 border-b border-gray-600 pb-1 flex justify-between items-baseline">
              <span>{definition.word}</span>
              <span className="font-mono text-[10px] text-gray-400 opacity-80">{definition.transcription}</span>
            </div>
            
            <div className="mb-2 leading-tight">{definition.text}</div>
           </div>
        )}
        {definition && <div className="fixed inset-0 z-40" onClick={() => setDefinition(null)}></div>}

        <div className="mb-4 text-xl leading-relaxed text-ink pr-4 selection:bg-yellow-200">
          {renderTextWithDiff()}
        </div>
        
        <div className="border-t border-dotted border-ink/30 pt-4 mt-2">
           {loading ? (
             <div className="flex items-center text-xs font-mono gap-2 py-1 text-gray-500">
               <Loader2 className="animate-spin w-3 h-3" /> gridsk·ai...
             </div>
           ) : showCustom ? (
             <div className="flex flex-col gap-2 animate-in fade-in duration-200">
               <div className="flex gap-2">
                 <input 
                   autoFocus
                   className="flex-1 bg-gray-50 border-b border-ink px-2 py-1 text-xs font-mono focus:outline-none focus:bg-yellow-50"
                   placeholder="e.g. Make it punchy..."
                   value={customPrompt}
                   onChange={e => setCustomPrompt(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleUpgrade('custom', customPrompt)}
                 />
                 <button onClick={() => handleUpgrade('custom', customPrompt)} className="px-2 bg-ink text-white text-xs hover:bg-gray-700 font-mono">GO</button>
                 <button onClick={() => setShowCustom(false)} className="px-1 text-ink hover:bg-red-100"><X size={14}/></button>
               </div>
               
               {/* PRESET CHIPS */}
               <div className="flex flex-wrap gap-2">
                 {CUSTOM_PRESETS.map(preset => (
                    <button 
                      key={preset}
                      onClick={() => handleUpgrade('custom', `Make it ${preset}`)}
                      className="px-2 py-0.5 bg-gray-100 border border-gray-300 text-[9px] font-mono hover:bg-ink hover:text-white hover:border-ink transition-colors"
                    >
                      {preset}
                    </button>
                 ))}
               </div>
             </div>
           ) : (
             <div className="flex flex-col gap-3">
               
               {/* ROW 1: The Elevation Control (Elevate + Dial) */}
               <div className="flex items-center gap-2">
                 <button onClick={() => handleUpgrade('sophisticate')} className="flex-1 py-1 bg-transparent border border-ink text-[10px] tracking-widest font-mono font-bold uppercase hover:bg-ink hover:text-white transition-all active:translate-y-0.5">
                   ↑ Elevate
                 </button>
                 
                 {/* THE LEVEL DIAL */}
                 <div className="flex border border-ink bg-gray-50">
                    {[1, 2].map((l) => (
                      <button 
                        key={l}
                        onClick={() => { playSound('click'); setLevel(l); }}
                        className={`px-2 py-1 text-[9px] font-mono border-r last:border-r-0 border-ink transition-colors ${level === l ? 'bg-ink text-white' : 'text-gray-400 hover:text-ink'}`}
                        title={l === 1 ? "Proficiency" : "Expansion"}
                      >
                        {l === 1 ? 'I' : 'II'}
                      </button>
                    ))}
                 </div>

               {/* ROW 2: Ground & Custom */}
               <div className="flex gap-2">
                  <button onClick={() => handleUpgrade('simplify')} className="flex-1 py-1 bg-transparent border border-ink text-[10px] tracking-widest font-mono font-bold uppercase hover:bg-ink hover:text-white transition-all active:translate-y-0.5">
                    ↓ Ground
                  </button>
                  
                  {/* Custom Button (Labeled) */}
                  <button onClick={() => setShowCustom(true)} className="flex-1 py-1 bg-transparent border border-ink text-[10px] tracking-widest font-mono font-bold uppercase hover:bg-ink hover:text-white transition-all active:translate-y-0.5 flex items-center justify-center gap-2">
                   → Custom
                  </button>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = { paper: PaperNode };

// --- CANVAS LOGIC ---
function GridCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [inputText, setInputText] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const { setCenter, getNodes } = useReactFlow();
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [startMode, setStartMode] = useState('speaking');

const triggerRestart = () => {
  playSound('click');
  setShowRestartConfirm(true);
};

const performRestart = () => {
  setNodes([]);
  setEdges([]);
  setHasStarted(false);
  setInputText('');
  setShowRestartConfirm(false);
  playSound('paper');
};

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
        link.download = 'gridsk·ai-study-map.png';
        link.href = dataUrl;
        link.click();
      });
    }
  };

  const handleUpgradeRequest = useCallback(async (parentId, parentText, parentReason, mode, customPrompt = null, level = 2, contextMode = 'speaking') => {
    
    const result = await apiCall({ text: parentText, mode, context: parentReason, customPrompt, level, contextMode });
    if (!result) return;

    const newNodeId = `${Date.now()}`;
    
    // Default Handles
    let sourceHandleId = 'top-src'; 
    let targetHandleId = 'bottom-tgt';    
    
    // SPACING CONFIG
    const VERTICAL_GAP = 450;   
    const HORIZONTAL_GAP = 900; 
    const NODE_WIDTH = 500;     
    const NODE_HEIGHT = 250;    

    // RANDOM "DRIFT" (This creates the organic feel)
    // We add a random number between -100 and 100 to prevent straight lines
    const driftX = (Math.random() * 200) - 100; 
    const driftY = (Math.random() * 100) - 50;

    let dx = 0; 
    let dy = 0;
    let directionType = 'vertical';

    switch (mode) {
      case 'sophisticate': // UP + DRIFT
        dy = -VERTICAL_GAP; 
        dx = driftX; // Add the horizontal wobble
        sourceHandleId = 'top-src'; targetHandleId = 'bottom-tgt'; 
        directionType = 'vertical';
        break;
        
      case 'simplify': // DOWN + DRIFT
        dy = VERTICAL_GAP;
        dx = driftX; // Add the horizontal wobble
        sourceHandleId = 'bottom'; targetHandleId = 'top';
        directionType = 'vertical';
        break;
        
      // CUSTOM / EXPAND -> MOVES RIGHT
      case 'emotional': 
      case 'custom': 
        dx = HORIZONTAL_GAP; 
        dy = driftY; // Add slight vertical wobble
        sourceHandleId = 'right'; targetHandleId = 'left';
        directionType = 'horizontal';
        break;
        
      default:
        dy = VERTICAL_GAP;
    }

    setNodes((currentNodes) => {
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return currentNodes;

      // Initial Proposal
      let candidateX = parentNode.position.x + dx;
      let candidateY = parentNode.position.y + dy;

      // Collision Detection
      let overlap = true;
      let shiftCount = 0;
      
      while (overlap) {
        overlap = currentNodes.some(n => {
          const xDiff = Math.abs(n.position.x - candidateX);
          const yDiff = Math.abs(n.position.y - candidateY);
          return xDiff < (NODE_WIDTH - 50) && yDiff < (NODE_HEIGHT - 50);
        });

        if (overlap) {
          shiftCount++;
          if (directionType === 'vertical') {
             // If vertical movement blocked, shift sideways significantly
             const sign = shiftCount % 2 === 0 ? -1 : 1;
             candidateX += (NODE_WIDTH * sign * Math.ceil(shiftCount/2));
          } else {
             // If horizontal movement blocked, shift down
             candidateY += NODE_HEIGHT;
          }
        }
      }

      const calculatedPos = { x: candidateX, y: candidateY };

      const newNode = {
        id: newNodeId,
        type: 'paper',
        position: calculatedPos,
        width: 480,
        height: 200,
        data: { 
          text: result.text, 
          reason: result.reason,
          previousText: parentText,
          onUpgrade: handleUpgradeRequest,
          initialLevel: level,
          contextMode: contextMode
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
        type: 'default', 
        
        style: { stroke: '#1a1a1a', strokeWidth: 2 }, 
        label: result.reason, 
  labelStyle: { 
    fill: '#1a1a1a', 
    fontFamily: 'JetBrains Mono', 
    fontSize: 10, 
    fontWeight: 700,
    width: 200, // Explicitly tell React Flow the intended width
  },
  labelBgStyle: { 
    fill: '#F9F6C8', 
    stroke: '#1a1a1a', 
    strokeWidth: 1,
  },
  labelBgPadding: [8, 6], // Increased padding for better readability
  labelBgBorderRadius: 0,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#1a1a1a', width: 20, height: 20 },
};
      playSound('paper');
      return [...currentEdges, newEdge];
    });

    // Zoom to new node (Center logic remains same)
    // Zoom logic adjusted for drift
    const approxX = (dx) + (getNodes().find(n => n.id === parentId)?.position.x || 0);
    const approxY = (dy) + (getNodes().find(n => n.id === parentId)?.position.y || 0);

    setTimeout(() => {
       setCenter(approxX + 240, approxY + 100, { zoom: 1.3, duration: 1200 });
    }, 100);

  }, [setCenter, getNodes]);

  const startSession = () => {
    if(!inputText) return;
    setHasStarted(true);
    
  
  setNodes([{
      id: '1', type: 'paper',
      position: { x: 0, y: 0 },
      width: 480, height: 200,
      data: { 
          text: inputText, 
          onUpgrade: handleUpgradeRequest, 
          previousText: null,
          contextMode: startMode
      },
    }]);
  
  // Center on the node at exactly zoom 1.0
  // Added a tiny timeout to ensure React Flow has registered the node first
  setTimeout(() => {
    setCenter(240, 100, { zoom: 1.2, duration: 800 });
    }, 50);
  };

  return (
    <div className="w-screen h-screen font-serif text-ink relative">
      
      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1 items-start">
          <h1 className="text-4xl font-serif tracking-tight pointer-events-auto">gridsk·ai</h1>
          <div className="flex gap-2 pointer-events-auto">
            <p className="font-mono text-xs bg-white border border-ink inline-block px-2 py-1">
              {nodes.length} NODES CREATED
            </p>
            {hasStarted && (
              <button 
                onClick={triggerRestart}
                className="bg-white border border-ink px-2 py-1 font-mono text-xs hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1 pointer-events-auto"
              >
                <RotateCcw size={12} /> NEW GRID
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={handleDownload} 
          className="pointer-events-auto bg-white border border-ink p-2 hover:bg-gray-100" 
          title="Download Snapshot"
        >
          <Camera size={20} />
        </button>
      </div>

      {/* LOGO (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-50 pointer-events-none mix-blend-multiply opacity-80">
        <img src="/logo.png" alt="Gridscape Logo" className="h-16 w-auto object-contain" />
      </div>

      {/* START SCREEN (Only shows if sessions hasn't started) */}
      {!hasStarted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-grid-bg/90 backdrop-blur-sm">
          <div className="bg-white border border-ink p-8 shadow-hard max-w-lg w-full">
            <h2 className="text-3xl font-serif mb-6 tracking-tight">Let's start from here</h2>
            <div className="relative">
              
              {/* CONTEXT TOGGLE */}
              <div className="flex gap-0 mb-[-1px] relative z-10 ml-1">
                <button 
                  onClick={() => setStartMode('speaking')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-mono border-t border-l border-r border-ink transition-all ${startMode === 'speaking' ? 'bg-white text-ink pb-3' : 'bg-gray-200 text-gray-500 border-b'}`}
                >
                  <Mic size={14} /> SPEAKING
                </button>
                <button 
                  onClick={() => setStartMode('writing')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-mono border-t border-l border-r border-ink transition-all ${startMode === 'writing' ? 'bg-white text-ink pb-3' : 'bg-gray-200 text-gray-500 border-b'}`}
                >
                  <PenTool size={14} /> WRITING
                </button>
              </div>

              {/* TEXT AREA */}
              <textarea
                className="w-full h-32 border border-ink p-4 font-serif text-lg focus:outline-none resize-none mb-2 bg-white focus:bg-white transition-colors placeholder:text-gray-400 placeholder:italic rounded-tl-none"
                placeholder={startMode === 'speaking' ? "What do you want to say?" : "What do you want to write?"}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              
              {/* WORD COUNT INDICATOR */}
              <div className={`absolute bottom-4 right-4 text-xs font-mono px-2 py-1 bg-white border border-ink ${
                inputText.trim().split(/\s+/).filter(w => w.length > 0).length > 40 ? 'text-red-600 border-red-600 bg-red-50' : 'text-gray-400'
              }`}>
                {inputText.trim().split(/\s+/).filter(w => w.length > 0).length} / 40 WORDS
              </div>
            </div>

            {inputText.trim().split(/\s+/).filter(w => w.length > 0).length > 40 && (
              <p className="text-red-600 text-xs font-mono mb-4 text-center">SEED PHRASE TOO LONG. PLEASE SHORTEN.</p>
            )}

            <button 
              onClick={startSession}
              disabled={!inputText || inputText.trim().split(/\s+/).filter(w => w.length > 0).length > 40}
              className="w-full bg-ink text-white py-4 font-mono text-sm tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:translate-y-1"
            >
              PLACE ON GRID <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* THEMED RESTART CONFIRMATION (Placed outside Start Screen so it can show over the grid) */}
      {showRestartConfirm && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-grid-bg/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-ink p-8 shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] max-w-sm w-full node-enter-anim">
            <h2 className="text-2xl font-serif mb-2 tracking-tight">Clear the grid?</h2>
            <p className="font-serif text-gray-600 mb-6 italic">This will permanently remove all your progress and nodes.</p>
            <div className="flex gap-3">
              <button onClick={performRestart} className="flex-1 bg-ink text-white py-3 font-mono text-xs tracking-widest hover:bg-red-600 transition-colors uppercase font-bold">Yes, Wipe It</button>
              <button onClick={() => setShowRestartConfirm(false)} className="flex-1 bg-white border border-ink py-3 font-mono text-xs tracking-widest hover:bg-gray-100 transition-colors uppercase font-bold">Nevermind</button>
            </div>
          </div>
        </div>
      )}

      {/* REACT FLOW CANVAS */}
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
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