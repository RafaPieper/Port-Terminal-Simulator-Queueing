import React, { useState, useMemo } from 'react';
import { Anchor, Ship, Clock, AlertTriangle, Activity, BarChart3, Settings } from 'lucide-react';

// --- Queueing Theory Math (M/M/c Model) ---
const factorial = (n) => {
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
};

const calculateQueueMetrics = (throughput, consignment, berths, craneIntensity, stsProductivity) => {
  const hoursPerYear = 8760;
  
  // Arrival rate (lambda): ships per hour
  const lambda = throughput / consignment / hoursPerYear;

  const idleTime = 5.25  // Idle time in berth + Sailing time
  
  // Service rate per berth (mu): ships per hour
  // Berth handling capacity (Units/hr) based on crane intensity per berth
  const berthHandlingCapacity = craneIntensity * stsProductivity;

  const serviceTime = consignment / berthHandlingCapacity

  const berthTime = serviceTime + idleTime

  const mu = 1 / berthTime;
  
  // Traffic intensity / Utilization (rho)
  const rho = lambda / (berths * mu);

  const tau = lambda / mu
  
  if (rho >= 1) {
    return { stable: false, lambda, mu, rho, Lq: 0, Wq: 0, Ws: 0, Ls: 0, P0: 0 };
  }

  // Probability of 0 ships in system (P0)
  let sum = 0;
  for (let n = 0; n < berths; n++) {
    sum += Math.pow(tau, n) / factorial(n);
  }
  const P0 = 1 / (sum + (Math.pow(tau, berths) / (factorial(berths) * (1 - rho))));

  // Average ships in queue (Lq)
  const Lq = (P0 * Math.pow(tau, berths) * rho) / (factorial(berths) * Math.pow(1 - rho, 2));
  
  // Average waiting time in queue (Wq) - in hours
  const Wq = Lq / lambda;
  
  // Average time in system (Ws) - waiting + service time (turnaround)
  const Ws = Wq + 1 / mu;
  
  // Average ships in system (Ls)
  const Ls = lambda * Ws;

  return { stable: true, lambda, mu, rho, Lq, Wq, Ws, Ls, P0 };
};


// --- Custom SVG Line Chart Component ---
const SensitivityChart = ({ data, currentThroughput, currentWq }) => {
  const width = 600;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const validData = data.filter(d => d.stable && d.Wq < 1000); // Filter out extremes for drawing
  if (validData.length === 0) return <div className="text-center text-slate-500 py-10">System entirely unstable at these parameters.</div>;

  const minX = validData[0].throughput;
  const maxX = validData[validData.length - 1].throughput;
  // Make sure the Y-axis scale accommodates the higher bound of the confidence interval
  const maxY = Math.min(Math.max(...validData.map(d => d.WqHigh === 1000 ? d.Wq : d.WqHigh)) * 1.1, 60); 
  const minY = 0;

  const getX = (val) => padding.left + ((val - minX) / (maxX - minX)) * (width - padding.left - padding.right);
  const getY = (val) => height - padding.bottom - ((val - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
  
  // Clamps Y coordinates so the confidence interval shape doesn't draw way off-screen for unstable points
  const getClampedY = (val) => getY(Math.min(val, maxY));

  const pathD = `M ${validData.map(d => `${getX(d.throughput)},${getY(d.Wq)}`).join(' L ')}`;
  
  // Create upper and lower bound paths for the confidence interval shading
  const topPath = validData.map(d => `${getX(d.throughput)},${getClampedY(d.WqHigh)}`);
  const bottomPath = [...validData].reverse().map(d => `${getX(d.throughput)},${getClampedY(d.WqLow)}`);
  const areaPathD = `M ${topPath.join(' L ')} L ${bottomPath.join(' L ')} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const yVal = maxY * ratio;
          const y = getY(yVal);
          return (
            <g key={`grid-${ratio}`}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={padding.left - 10} y={y + 4} fontSize="10" fill="#64748b" textAnchor="end">
                {yVal.toFixed(0)}h
              </text>
            </g>
          );
        })}
        
        {/* Axes */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth="2" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth="2" />

        {/* X Axis Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const xVal = minX + (maxX - minX) * ratio;
          const x = getX(xVal);
          return (
            <text key={`x-label-${ratio}`} x={x} y={height - padding.bottom + 20} fontSize="10" fill="#64748b" textAnchor="middle">
              {(xVal / 1000).toFixed(0)}k
            </text>
          );
        })}
        <text x={width / 2} y={height - 5} fontSize="12" fill="#475569" textAnchor="middle" fontWeight="bold">
          Container Throughput (Units/year)
        </text>

        {/* Confidence Interval Area */}
        <path d={areaPathD} fill="#3b82f6" opacity="0.15" />

        {/* The Line */}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Current State Marker */}
        {currentWq !== undefined && currentThroughput !== undefined && currentWq <= maxY && (
          <circle cx={getX(currentThroughput)} cy={getY(currentWq)} r="5" fill="#ef4444" className="animate-pulse" />
        )}
      </svg>
    </div>
  );
};

// --- Terminal Illustration Component ---
const TerminalIllustration = ({ berths, craneIntensity, throughput, consignment }) => {
  const width = 800;
  const height = 320;
  const quayY = 120;

  // Maximum throughput matches slider max (2M)
  const maxThroughput = 2000000;
  const fillRatio = Math.min(Math.max(throughput / maxThroughput, 0), 1);
  
  // Yard grid configuration
  const cols = 20;
  const rows = 6;
  const totalStacks = cols * rows;
  const filledStacks = Math.floor(fillRatio * totalStacks);

  // Deterministic pseudo-random colors for containers
  const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9'];
  const getColor = (i) => colors[(i * 13) % colors.length];

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Anchor size={16} className="text-blue-500" /> Terminal Top-Down View
        </h3>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-[#e2e8f0]">
         {/* Sea Environment */}
        <rect x="0" y="0" width={width} height={quayY} fill="#bae6fd" />
        <path d="M 50 30 Q 60 20 70 30 T 90 30" fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.6"/>
        <path d="M 300 80 Q 310 70 320 80 T 340 80" fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.6"/>
        <path d="M 600 50 Q 610 40 620 50 T 640 50" fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.6"/>

        {/* Quay Edge */}
        <rect x="0" y={quayY} width={width} height="15" fill="#cbd5e1" />

        {/* Berths, Ships & Cranes */}
        {Array.from({ length: berths }).map((_, bIdx) => {
          const berthWidth = width / berths;
          const startX = bIdx * berthWidth;
          
          // Dynamic ship width based on consignment 
          const consignmentFactor = Math.min(Math.max((consignment - 500) / 2500, 0), 1);
          const minShipWidth = 150; // Ensure bridge and bow features always have room to draw
          const maxShipWidth = Math.min(berthWidth * 0.85, 240);
          const shipWidth = minShipWidth + consignmentFactor * (maxShipWidth - minShipWidth);
          
          const shipX = startX + (berthWidth - shipWidth) / 2;

          return (
            <g key={`berth-${bIdx}`}>
              {/* Divider lines between berths */}
              {bIdx < berths - 1 && (
                <line x1={startX + berthWidth} y1={quayY} x2={startX + berthWidth} y2={height} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 6" />
              )}
              
              {/* Berth Label */}
              <text x={startX + berthWidth / 2} y={quayY + 30} fontSize="12" fill="#94a3b8" textAnchor="middle" fontWeight="bold">
                BERTH {bIdx + 1}
              </text>

              {/* Realistic Ship Top-Down View */}
              <g transform={`translate(${shipX}, ${quayY - 45})`}>
                {/* Wake / Water displacement */}
                <path d={`M -5 20 L ${shipWidth + 5} 20`} stroke="#7dd3fc" strokeWidth="44" strokeLinecap="round" opacity="0.3" />
                
                {/* Hull */}
                <path
                  d={`M 5 0 L ${shipWidth - 30} 0 Q ${shipWidth} 0 ${shipWidth} 20 Q ${shipWidth} 40 ${shipWidth - 30} 40 L 5 40 L 0 35 L 0 5 Z`}
                  fill="#334155"
                  stroke="#1e293b"
                  strokeWidth="2"
                  style={{ filter: "drop-shadow(2px 5px 4px rgba(0,0,0,0.3))" }}
                />
                
                {/* Deck Area */}
                <path
                  d={`M 6 2 L ${shipWidth - 31} 2 Q ${shipWidth - 2} 2 ${shipWidth - 2} 20 Q ${shipWidth - 2} 38 ${shipWidth - 31} 38 L 6 38 Z`}
                  fill="#475569"
                />

                {/* Bridge / Superstructure (Stern) */}
                <rect x="15" y="6" width="16" height="28" fill="#e2e8f0" rx="2" />
                <rect x="20" y="2" width="6" height="36" fill="#cbd5e1" rx="1" /> {/* Bridge Wings */}
                <circle cx="10" cy="20" r="3" fill="#0f172a" /> {/* Funnel */}

                {/* Container Bays (Dynamic based on ship width) */}
                <g transform="translate(45, 0)">
                  {Array.from({ length: Math.max(1, Math.floor((shipWidth - 80) / 12)) }).map((_, bayIdx) => (
                    <g key={`bay-${bayIdx}`} transform={`translate(${bayIdx * 12}, 0)`}>
                       {/* 3 Rows of containers per bay */}
                       {[0, 1, 2].map(row => (
                         <rect
                           key={`c-${bayIdx}-${row}`}
                           x="0"
                           y={8 + row * 8}
                           width="10"
                           height="8"
                           fill={colors[(bayIdx * 3 + row + bIdx) % colors.length]}
                           stroke="#00000033"
                           strokeWidth="0.5"
                         />
                       ))}
                    </g>
                  ))}
                </g>
                
                {/* Bow Details (Helipad or Mooring deck) */}
                <circle cx={shipWidth - 15} cy="20" r="6" fill="#64748b" />
                <circle cx={shipWidth - 15} cy="20" r="3" fill="none" stroke="#94a3b8" strokeWidth="1" />
              </g>

              {/* STS Cranes */}
              {Array.from({ length: craneIntensity }).map((_, cIdx) => {
                // Constrain cranes to the container bay area of the ship
                const bayStartX = 45;
                const bayEndX = shipWidth - 20;
                const bayLength = bayEndX - bayStartX;
                
                // Ensure a minimum space between cranes (base is 16px wide, so >16px spacing guarantees a gap)
                const effectiveSpacing = Math.max(bayLength / craneIntensity, 22); 
                const totalCraneGroupWidth = effectiveSpacing * (craneIntensity - 1);
                
                // Center the group of cranes over the bay area
                const groupStartX = bayStartX + (bayLength / 2) - (totalCraneGroupWidth / 2);
                const craneX = shipX + groupStartX + (cIdx * effectiveSpacing);
                
                return (
                  <g key={`crane-${bIdx}-${cIdx}`} transform={`translate(${craneX}, ${quayY})`}>
                    {/* Landside Backreach & Machinery House */}
                    <rect x="-6" y="5" width="12" height="15" fill="#f59e0b" rx="1" />
                    <rect x="-4" y="8" width="8" height="8" fill="#334155" /> {/* Engine room */}

                    {/* Portal Base / Legs (on the quay) */}
                    <rect x="-8" y="-2" width="16" height="4" fill="#475569" rx="1" />
                    <rect x="-8" y="18" width="16" height="4" fill="#475569" rx="1" />

                    {/* Main Boom (Twin Girders extending over ship) */}
                    <rect x="-4" y="-55" width="2" height="65" fill="#f59e0b" />
                    <rect x="2" y="-55" width="2" height="65" fill="#f59e0b" />
                    
                    {/* Boom Cross-ties */}
                    <line x1="-3" y1="-48" x2="3" y2="-48" stroke="#f59e0b" strokeWidth="1" />
                    <line x1="-3" y1="-38" x2="3" y2="-38" stroke="#f59e0b" strokeWidth="1" />
                    <line x1="-3" y1="-28" x2="3" y2="-28" stroke="#f59e0b" strokeWidth="1" />
                    <line x1="-3" y1="-18" x2="3" y2="-18" stroke="#f59e0b" strokeWidth="1" />
                    <line x1="-3" y1="-8" x2="3" y2="-8" stroke="#f59e0b" strokeWidth="1" />

                    {/* Trolley (Moves along boom over the ship's containers) */}
                    <g transform={`translate(0, -28)`}>
                      <rect x="-5" y="-3" width="10" height="6" fill="#1e293b" rx="1" />
                      <rect x="-2" y="-1" width="4" height="2" fill="#ef4444" /> {/* Spreader/Hook */}
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Container Yard Blocks */}
        <g transform="translate(30, 170)">
          {Array.from({ length: totalStacks }).map((_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const isFilled = i < filledStacks;
            
            // Generate visual "blocks" with gaps (alleyways) between groups of containers
            const xOffset = col * 32 + Math.floor(col / 5) * 20;
            const yOffset = row * 18 + Math.floor(row / 3) * 12;

            return (
              <rect
                key={`stack-${i}`}
                x={xOffset}
                y={yOffset}
                width="28"
                height="14"
                fill={isFilled ? getColor(i) : '#f1f5f9'}
                stroke={isFilled ? '#00000022' : '#cbd5e1'}
                strokeWidth="1"
                rx="1"
                className={isFilled ? "transition-all duration-500" : ""}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};


// --- Main Application Component ---
export default function App() {
  // State variables for inputs
  const [throughput, setThroughput] = useState(650000);
  const [consignment, setConsignment] = useState(650);
  const [berths, setBerths] = useState(2);
  const [craneIntensity, setCraneIntensity] = useState(3);
  const [stsProductivity, setStsProductivity] = useState(25);

  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    return calculateQueueMetrics(throughput, consignment, berths, craneIntensity, stsProductivity);
  }, [throughput, consignment, berths, craneIntensity, stsProductivity]);

  // Generate data for sensitivity chart (Varying throughput +/- 50%)
  const chartData = useMemo(() => {
    const data = [];
    const minT = Math.max(100000, throughput * 0.5);
    const maxT = throughput * 1.5;
    const step = (maxT - minT) / 40;
    
    for (let t = minT; t <= maxT; t += step) {
      const metricsBase = calculateQueueMetrics(t, consignment, berths, craneIntensity, stsProductivity);
      // High wait times occur at lower productivity (-3)
      const metricsHigh = calculateQueueMetrics(t, consignment, berths, craneIntensity, Math.max(1, stsProductivity - 3));
      // Low wait times occur at higher productivity (+3)
      const metricsLow = calculateQueueMetrics(t, consignment, berths, craneIntensity, stsProductivity + 3);

      data.push({
        throughput: t,
        Wq: metricsBase.Wq,
        WqLow: metricsLow.stable ? metricsLow.Wq : 1000,
        WqHigh: metricsHigh.stable ? metricsHigh.Wq : 1000,
        stable: metricsBase.stable
      });
    }
    return data;
  }, [throughput, consignment, berths, craneIntensity, stsProductivity]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-xl text-white">
            <Anchor size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Container terminal queueing analysis</h1>
            <p className="text-slate-500 text-sm mt-1">
              Queuing Theory M/M/c Simulation Dashboard | Based on the paper:{' '}
              <a 
                href="https://www.researchgate.net/publication/398773609_TEORIA_DAS_FILAS_NO_PLANEJAMENTO_PORTUARIO_um_estudo_de_caso_com_o_terminal_de_conteineres_de_Salvador" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                Teoria das Filas no Planejamento Portuário
              </a>
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <Settings className="text-blue-500" size={20} />
                <h2 className="text-lg font-semibold">Terminal Parameters</h2>
              </div>

              <div className="space-y-6">
                {/* Throughput */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Expected Throughput</label>
                    <span className="text-sm text-blue-600 font-bold">{throughput.toLocaleString()} Units/yr</span>
                  </div>
                  <input type="range" min="100000" max="2000000" step="50000" value={throughput} onChange={(e) => setThroughput(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>

                {/* Consignment */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Consignment (Units/Ship)</label>
                    <span className="text-sm text-blue-600 font-bold">{consignment.toLocaleString()}</span>
                  </div>
                  <input type="range" min="500" max="2500" step="50" value={consignment} onChange={(e) => setConsignment(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>

                {/* Berths */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Number of Berths (c)</label>
                    <span className="text-sm text-blue-600 font-bold">{berths}</span>
                  </div>
                  <input type="range" min="1" max="3" step="1" value={berths} onChange={(e) => setBerths(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>

                {/* Crane Intensity */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Crane Intensity (per Berth)</label>
                    <span className="text-sm text-blue-600 font-bold">{craneIntensity}</span>
                  </div>
                  <input type="range" min="1" max="6" step="1" value={craneIntensity} onChange={(e) => setCraneIntensity(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>

                {/* STS Productivity */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">STS Productivity</label>
                    <span className="text-sm text-blue-600 font-bold">{stsProductivity} moves/hr</span>
                  </div>
                  <input type="range" min="15" max="50" step="1" value={stsProductivity} onChange={(e) => setStsProductivity(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Results & Charts */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Alert Banner for Unstable Systems */}
            {!currentMetrics.stable && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="text-red-800 font-bold">System Overloaded (Unstable Queue)</h3>
                  <p className="text-red-700 text-sm mt-1">
                    The arrival rate exceeds the maximum service capacity (Utilization &ge; 100%). Ships will queue indefinitely. Increase berths, STS cranes, or productivity.
                  </p>
                </div>
              </div>
            )}

            {/* Dynamic Top-Down Terminal Illustration */}
            <TerminalIllustration berths={berths} craneIntensity={craneIntensity} throughput={throughput} consignment={consignment} />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2"><Activity size={16} /> Utilization (ρ)</div>
                <div className={`text-3xl font-bold ${currentMetrics.rho >= 0.85 ? 'text-red-600' : currentMetrics.rho >= 0.70 ? 'text-orange-500' : 'text-emerald-600'}`}>
                  {(currentMetrics.rho * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400 mt-1">Target: &lt; 70%</div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2"><Clock size={16} /> Avg Wait (Wq)</div>
                <div className="text-3xl font-bold text-slate-800">
                  {currentMetrics.stable ? currentMetrics.Wq.toFixed(1) : '∞'} <span className="text-lg font-medium text-slate-500">hrs</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Time spent in queue</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2"><Ship size={16} /> Turnaround (Ws)</div>
                <div className="text-3xl font-bold text-slate-800">
                   {currentMetrics.stable ? currentMetrics.Ws.toFixed(1) : '∞'} <span className="text-lg font-medium text-slate-500">hrs</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Wait + Service Time</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2"><BarChart3 size={16} /> Queue Length (Lq)</div>
                <div className="text-3xl font-bold text-slate-800">
                  {currentMetrics.stable ? currentMetrics.Lq.toFixed(1) : '∞'} <span className="text-lg font-medium text-slate-500">ships</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Avg ships waiting</div>
              </div>
            </div>

            {/* Diagnostic Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-wrap gap-x-8 gap-y-4 text-sm">
              <div><span className="text-slate-500">Arrival Rate (λ): </span><span className="font-semibold text-slate-800">{(currentMetrics.lambda * 24 * 365).toFixed(0)} ships/yr</span></div>
              <div><span className="text-slate-500">Service Rate per Berth (μ): </span><span className="font-semibold text-slate-800">{(currentMetrics.mu * 24 * 365).toFixed(0)} ships/yr</span></div>
              <div><span className="text-slate-500">Base Service Time: </span><span className="font-semibold text-slate-800">{currentMetrics.stable ? (1/currentMetrics.mu).toFixed(1) : '-'} hrs</span></div>
            </div>

            {/* Chart Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Sensitivity Analysis: Wait Time vs Throughput
                </h2>
                <p className="text-sm text-slate-500">Visualizing the exponential growth of wait times as the port approaches maximum capacity. Shaded area shows ±3 moves/hr STS productivity variation.</p>
              </div>
              <SensitivityChart data={chartData} currentThroughput={throughput} currentWq={currentMetrics.stable ? currentMetrics.Wq : undefined} />
              <div className="text-center text-xs text-slate-400 mt-2">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1 animate-pulse"></span> Red dot indicates your current parameter selection.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}