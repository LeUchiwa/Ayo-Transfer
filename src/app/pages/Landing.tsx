import { Link } from "react-router";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Send, Shield, Zap, TrendingUp, Users, Globe,
  CheckCircle, ArrowRight, ChevronDown, Wallet,
  Smartphone, Lock, Clock, Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import ayoLogo from "@/imports/AYO.png";
import heroBg from "@/imports/hero-bg.jpg";

const FEATURES = [
  {
    icon: Send,
    title: "Transferts instantanés",
    desc: "Envoyez de l'argent à vos proches en quelques secondes, 24h/24 et 7j/7.",
  },
  {
    icon: Shield,
    title: "100% sécurisé",
    desc: "Vos transactions sont protégées par un chiffrement bancaire et une vérification d'identité (KYC).",
  },
  {
    icon: Zap,
    title: "Frais ultra-réduits",
    desc: "Des tarifs parmi les plus bas du marché. Pas de frais cachés, pas d'abonnement.",
  },
  {
    icon: Globe,
    title: "Multi-opérateurs",
    desc: "MTN MoMo, Orange Money, Wave, Djamo, Express Union, carte bancaire, virement — tout est supporté.",
  },
  {
    icon: Smartphone,
    title: "Application mobile",
    desc: "Installez AYO sur votre téléphone en 2 clics, sans passer par le Play Store.",
  },
  {
    icon: Clock,
    title: "Support 24/7",
    desc: "Une équipe dédiée pour vous accompagner à chaque étape de vos transactions.",
  },
];

const PRICING = [
  { method: "MTN Mobile Money", deposit: "0%", withdraw: "0,5%", icon: "📱" },
  { method: "Orange Money", deposit: "0%", withdraw: "0,5%", icon: "📱" },
  { method: "Wave", deposit: "0%", withdraw: "0,3%", icon: "🌊" },
  { method: "Djamo", deposit: "0%", withdraw: "0,5%", icon: "💜" },
  { method: "Express Union", deposit: "0%", withdraw: "1,5%", icon: "🏪" },
  { method: "Carte bancaire", deposit: "1,5%", withdraw: "—", icon: "💳" },
  { method: "Virement bancaire", deposit: "0%", withdraw: "1%", icon: "🏛️" },
];

const FAQ = [
  {
    q: "Comment envoyer de l'argent avec AYO ?",
    a: "Créez votre compte gratuit en 2 minutes, ajoutez un bénéficiaire par son adresse email, entrez le montant et validez. Le destinataire reçoit instantanément les fonds sur son compte AYO.",
  },
  {
    q: "Combien coûte un transfert ?",
    a: "Les transferts entre utilisateurs AYO coûtent 1% du montant. Les dépôts sont gratuits via MTN, Orange, Wave et Djamo. Les retraits varient entre 0,3% et 1,5% selon l'opérateur.",
  },
  {
    q: "Quels sont les montants minimum et maximum ?",
    a: "Vous pouvez transférer à partir de 1 000 FCFA. Sans vérification KYC, la limite est de 500 000 FCFA par jour et 2 000 000 FCFA par mois. Une fois votre identité vérifiée, ces limites sont multipliées par 4.",
  },
  {
    q: "AYO est-il sécurisé ?",
    a: "Oui. Nous utilisons un chiffrement de bout en bout, la vérification d'identité (KYC) pour les gros montants, et un système anti-fraude qui détecte les comportements suspects en temps réel.",
  },
  {
    q: "Comment installer AYO sur mon téléphone ?",
    a: "AYO est une Progressive Web App (PWA). Sur Android : ouvrez le menu Chrome et choisissez 'Installer l'application'. Sur iPhone : appuyez sur le bouton Partager de Safari, puis 'Sur l'écran d'accueil'.",
  },
  {
    q: "Que faire si j'ai un problème avec une transaction ?",
    a: "Contactez notre support à contact@ayo-transfer.com. Chaque transaction a une référence unique que vous pouvez nous communiquer pour un traitement rapide (généralement sous 2h).",
  },
];

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white">
      {/* ═══════ HEADER ═══════ */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-3">
            <img src={ayoLogo} alt="AYO" className="h-10 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-teal-600 transition-colors">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-teal-600 transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-teal-600 transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Connexion</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                Créer un compte
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════ HERO AVEC IMAGE DE FOND ═══════ */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Image de fond */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        
        {/* Overlay sombre (teal-900) pour lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-r from-teal-950/95 via-teal-900/80 to-teal-800/40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="bg-teal-500/20 text-teal-100 border-teal-400/30 mb-4 backdrop-blur-sm">
                <Sparkles className="w-3 h-3 mr-1" />
                Nouveau : disponible partout au Cameroun
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Envoyez de l'argent <span className="text-teal-300">en un clin d'œil</span>
              </h1>
              <p className="text-lg text-teal-50/90 mb-8 max-w-lg">
                AYO est l'application de transfert d'argent la plus simple et la plus abordable
                du Cameroun. Rapide, sécurisée, accessible à tous.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link to="/register">
                  <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50 gap-2 w-full sm:w-auto font-semibold">
                    Commencer gratuitement
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm">
                    Voir les fonctionnalités
                  </Button>
                </a>
              </div>
              <div className="flex items-center gap-6 text-sm text-teal-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-300" />
                  Gratuit
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-300" />
                  Sans engagement
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-300" />
                  Disponible 24/7
                </div>
              </div>
            </motion.div>

            {/* Mockup carte - effet verre */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Solde disponible</p>
                    <p className="text-3xl font-bold text-gray-900">50 000 FCFA</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-teal-600" />
                  </div>
                </div>
                <div className="space-y-3 mt-6">
                  {[
                    { label: "Jean Mballa", amount: "+5 000", dir: "received" },
                    { label: "Marie Ngono", amount: "-10 000", dir: "sent" },
                    { label: "Dépôt MTN", amount: "+25 000", dir: "received" },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.dir === "received" ? "bg-green-100" : "bg-red-100"}`}>
                          {tx.dir === "received" ? <TrendingUp className="w-4 h-4 text-green-600" /> : <Send className="w-4 h-4 text-red-600" />}
                        </div>
                        <p className="text-sm font-medium text-gray-900">{tx.label}</p>
                      </div>
                      <p className={`text-sm font-semibold ${tx.dir === "received" ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount} FCFA
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "10 000+", label: "Utilisateurs actifs" },
            { value: "99,9%", label: "Disponibilité" },
            { value: "< 3 sec", label: "Temps de transfert" },
            { value: "0 FCFA", label: "Frais d'inscription" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl md:text-4xl font-bold text-teal-600 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              AYO combine simplicité, sécurité et rapidité pour vous offrir la meilleure
              expérience de transfert d'argent.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Card key={f.title} className="hover:shadow-lg transition-shadow border-gray-100">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tarifs transparents
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Pas de frais cachés, pas d'abonnement. Vous payez uniquement quand vous utilisez AYO.
            </p>
          </div>
          <Card className="border-gray-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-gray-700">Méthode</th>
                    <th className="text-center px-6 py-4 font-semibold text-gray-700">Dépôt</th>
                    <th className="text-center px-6 py-4 font-semibold text-gray-700">Retrait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {PRICING.map((row) => (
                    <tr key={row.method} className="hover:bg-teal-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{row.icon}</span>
                          <span className="font-medium text-gray-900">{row.method}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={row.deposit === "0%" ? "text-green-600 font-semibold" : "text-gray-700"}>
                          {row.deposit}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700">{row.withdraw}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-teal-50 px-6 py-4 border-t border-teal-100">
              <p className="text-sm text-teal-900">
                <strong>Transfert entre utilisateurs AYO :</strong> 1% du montant envoyé.
                Minimum 1 000 FCFA par transaction.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Questions fréquentes
            </h2>
            <p className="text-lg text-gray-600">
              Tout ce que vous devez savoir sur AYO
            </p>
          </div>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <Card key={i} className="border-gray-100 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-4"
                  >
                    <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA FINAL ═══════ */}
      <section className="py-20 bg-gradient-to-br from-teal-600 to-cyan-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à simplifier vos transferts ?
          </h2>
          <p className="text-lg text-teal-50 mb-8 max-w-2xl mx-auto">
            Rejoignez des milliers d'utilisateurs qui font confiance à AYO pour envoyer
            et recevoir de l'argent en toute sécurité.
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-white text-teal-600 hover:bg-gray-100 gap-2">
              Créer mon compte gratuit
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={ayoLogo} alt="AYO" className="h-8 w-auto" />
                <span className="text-white font-bold text-lg">AYO</span>
              </div>
              <p className="text-sm">Transfert d'argent simple, rapide et sécurisé au Cameroun.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-white">Tarifs</a></li>
                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Légal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms" className="hover:text-white">Conditions d'utilisation</Link></li>
                <li><Link to="/privacy" className="hover:text-white">Politique de confidentialité</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>📧 contact@ayo-transfer.com</li>
                <li>📍 Douala, Cameroun</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-sm">
            © 2026 AYO Transfer. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
