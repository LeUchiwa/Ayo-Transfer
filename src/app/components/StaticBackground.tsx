export function StaticBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: '#e8f5f0' }}>
      {/* Base gradient overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #d4f0e8 0%, #e0f4ef 40%, #d8eef8 70%, #cce8f4 100%)' }} />

      {/* Graffiti spray paint blobs */}
      <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #00c896 0%, transparent 70%)' }} />
      <div className="absolute top-10 right-20 w-56 h-56 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #00a8d4 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 -right-10 w-80 h-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #00b89c 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-1/4 w-96 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(ellipse, #00c8a0 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-1/3 w-52 h-52 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #00b4d8 0%, transparent 70%)' }} />

      {/* Graffiti bubble letters / tag shapes */}
      <svg className="absolute top-8 left-8 opacity-[0.07]" width="200" height="120" viewBox="0 0 200 120">
        <text x="10" y="90" fontFamily="Arial Black, sans-serif" fontSize="80" fontWeight="900" fill="#00a878" letterSpacing="-2">PAY</text>
      </svg>
      <svg className="absolute bottom-12 right-8 opacity-[0.07]" width="280" height="130" viewBox="0 0 280 130">
        <text x="10" y="100" fontFamily="Arial Black, sans-serif" fontSize="85" fontWeight="900" fill="#007ab8" letterSpacing="-3">SEND</text>
      </svg>
      <svg className="absolute top-1/2 left-4 opacity-[0.05]" width="160" height="90" viewBox="0 0 160 90">
        <text x="5" y="70" fontFamily="Arial Black, sans-serif" fontSize="60" fontWeight="900" fill="#009480" letterSpacing="-1">GO!</text>
      </svg>

      {/* Graffiti geometric shapes — thick outlined */}
      <svg className="absolute top-24 right-40 opacity-10" width="90" height="90" viewBox="0 0 90 90">
        <rect x="5" y="5" width="80" height="80" rx="12" fill="none" stroke="#00a878" strokeWidth="6" />
        <rect x="18" y="18" width="54" height="54" rx="8" fill="none" stroke="#00c896" strokeWidth="4" />
      </svg>
      <svg className="absolute bottom-36 left-16 opacity-10" width="80" height="80" viewBox="0 0 80 80">
        <polygon points="40,5 75,70 5,70" fill="none" stroke="#007ab8" strokeWidth="6" />
        <polygon points="40,20 64,65 16,65" fill="none" stroke="#00a0d0" strokeWidth="3" />
      </svg>
      <svg className="absolute top-1/2 right-12 opacity-10" width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r="30" fill="none" stroke="#00b89c" strokeWidth="6" />
        <circle cx="35" cy="35" r="18" fill="none" stroke="#00d4a8" strokeWidth="3" />
      </svg>

      {/* Arrow graffiti shapes */}
      <svg className="absolute top-1/4 left-1/3 opacity-8" width="60" height="60" viewBox="0 0 60 60">
        <polyline points="10,30 40,30 30,18" fill="none" stroke="#00a878" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="40,30 30,42" fill="none" stroke="#00a878" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="absolute bottom-1/4 right-1/4 opacity-8" width="60" height="60" viewBox="0 0 60 60">
        <polyline points="10,30 40,30 30,18" fill="none" stroke="#007ab8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="40,30 30,42" fill="none" stroke="#007ab8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Spray paint dots clusters */}
      {[
        { cx: 120, cy: 60, color: '#00c896' },
        { cx: 135, cy: 52, color: '#00a878' },
        { cx: 125, cy: 75, color: '#00b88a' },
        { cx: 110, cy: 68, color: '#00c896' },
        { cx: 142, cy: 67, color: '#00a060' },
      ].map((dot, i) => (
        <svg key={i} className="absolute opacity-15" style={{ top: `${15 + i * 12}%`, left: `${60 + i * 3}%` }} width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r={3 + (i % 3)} fill={dot.color} />
        </svg>
      ))}
      {[
        { top: '70%', left: '8%' },
        { top: '72%', left: '10%' },
        { top: '68%', left: '12%' },
        { top: '74%', left: '7%' },
      ].map((pos, i) => (
        <div key={i} className="absolute w-2 h-2 rounded-full opacity-20" style={{ top: pos.top, left: pos.left, backgroundColor: '#00b8a0' }} />
      ))}
      {[
        { top: '20%', right: '15%' },
        { top: '22%', right: '13%' },
        { top: '18%', right: '17%' },
        { top: '24%', right: '16%' },
      ].map((pos, i) => (
        <div key={i} className="absolute w-1.5 h-1.5 rounded-full opacity-20" style={{ top: pos.top, right: pos.right, backgroundColor: '#0090c8' }} />
      ))}

      {/* Star / asterisk graffiti */}
      <svg className="absolute top-[15%] left-[80%] opacity-10" width="40" height="40" viewBox="0 0 40 40">
        <line x1="20" y1="2" x2="20" y2="38" stroke="#00a878" strokeWidth="4" strokeLinecap="round" />
        <line x1="2" y1="20" x2="38" y2="20" stroke="#00a878" strokeWidth="4" strokeLinecap="round" />
        <line x1="7" y1="7" x2="33" y2="33" stroke="#00a878" strokeWidth="4" strokeLinecap="round" />
        <line x1="33" y1="7" x2="7" y2="33" stroke="#00a878" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <svg className="absolute top-[65%] left-[55%] opacity-10" width="32" height="32" viewBox="0 0 32 32">
        <line x1="16" y1="2" x2="16" y2="30" stroke="#0090c8" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="2" y1="16" x2="30" y2="16" stroke="#0090c8" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="6" y1="6" x2="26" y2="26" stroke="#0090c8" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="26" y1="6" x2="6" y2="26" stroke="#0090c8" strokeWidth="3.5" strokeLinecap="round" />
      </svg>

      {/* Grid dots pattern */}
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,168,120,0.08) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

      {/* Subtle vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,100,80,0.06) 100%)' }} />
    </div>
  );
}
