import React from "react";
import mtnLogo from "@/imports/Logos/mtn.png";
import orangeLogo from "@/imports/Logos/orange.png";
import waveLogo from "@/imports/Logos/wave.png";
import djamoLogo from "@/imports/Logos/djamo.jpeg";
import expressLogo from "@/imports/Logos/express.png";
import cardLogo from "@/imports/Logos/card.png";
import bankLogo from "@/imports/Logos/bank.png";

interface Props {
  name: string;      
  fallbackIcon?: string; 
  className?: string;    
}

export function ServiceLogo({ name, fallbackIcon = "💳", className = "w-8 h-8 object-contain" }: Props) {
  const n = name.toLowerCase();

  if (n.includes("mtn")) return <img src={mtnLogo} alt="MTN" className={className} />;
  if (n.includes("orange")) return <img src={orangeLogo} alt="Orange" className={className} />;
  if (n.includes("wave")) return <img src={waveLogo} alt="Wave" className={className} />;
  if (n.includes("djamo")) return <img src={djamoLogo} alt="Djamo" className={className} />;
  if (n.includes("express")) return <img src={expressLogo} alt="Express Union" className={className} />;
  if (n.includes("carte") || n.includes("card")) return <img src={cardLogo} alt="Carte" className={className} />;
  if (n.includes("virement") || n.includes("banque") || n.includes("bank")) return <img src={bankLogo} alt="Banque" className={className} />;

  return <span className="flex items-center justify-center text-xl">{fallbackIcon}</span>;
}
