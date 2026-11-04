import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe } from "lucide-react";

interface WelcomeMessage {
  text: string;
  lang: string;
  flag: string;
}

const WELCOME_MESSAGES: WelcomeMessage[] = [
  { text: "Bienvenue sur AYO", lang: "Français", flag: "🇫🇷" },
  { text: "Welcome to AYO", lang: "English", flag: "🇬🇧" },
  { text: "Mbolo AYO", lang: "Ewondo", flag: "🇨🇲" },
  { text: "Po la bwam AYO", lang: "Douala", flag: "🇨🇲" },
  { text: "Mejwi AYO", lang: "Bamiléké", flag: "🇨🇲" },
  { text: "Maloh malam AYO", lang: "Bassa", flag: "🇨🇲" },
  { text: "Dalal ak jamm AYO", lang: "Wolof", flag: "🇸🇳" },
  { text: "Karibu AYO", lang: "Kiswahili", flag: "🇰🇪" },
];

export function WelcomeRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % WELCOME_MESSAGES.length);
    }, 2800); // 2.8 secondes par message
    return () => clearInterval(interval);
  }, []);

  const current = WELCOME_MESSAGES[index];

  return (
    <div className="flex items-center gap-3 h-12">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Globe className="w-4 h-4 text-primary" />
      </div>
      <div className="relative flex-1 min-w-0 h-full flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-2 w-full"
          >
            <span className="text-lg">{current.flag}</span>
            <span className="font-poppins font-semibold text-foreground truncate">
              {current.text}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              · {current.lang}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Barre de progression */}
      <div className="flex gap-1 flex-shrink-0">
        {WELCOME_MESSAGES.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === index ? "bg-primary" : "bg-muted-foreground/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}