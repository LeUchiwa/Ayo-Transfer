import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from "react-router";
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../../utils/supabase/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, Zap, TrendingUp, ArrowRight, Ban } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { WelcomeRotator } from '../components/WelcomeRotator';
import ayoLogo from '@/imports/AYO.png';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirect") || "/";
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Connexion réussie !');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if ((error as Error).message === "BANNED") {
        setIsBanned(true);
        toast.error("Compte suspendu");
      } else {
        toast.error('Erreur de connexion. Vérifiez vos identifiants.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Côté gauche : Branding AYO ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary to-cyan-600 overflow-hidden">
        {/* Cercles décoratifs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 dark:bg-slate-900/10 rounded-full -translate-y-48 translate-x-48" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 dark:bg-slate-900/5 rounded-full translate-y-40 -translate-x-40" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/5 dark:bg-slate-900/5 rounded-full" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm flex items-center justify-center">
  <ImageWithFallback src={ayoLogo} alt="AYO" className="h-8 w-auto object-contain" />
</div>
            <div>
              <p className="text-white font-poppins font-bold text-xl">AYO</p>
              <p className="text-white/70 text-xs">Transfert d'argent</p>
            </div>
          </motion.div>

          {/* Contenu central */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-4xl font-poppins font-bold text-white leading-tight">
                Envoyez de l'argent <br />
                en toute simplicité.
              </h1>
              <p className="text-white/80 mt-4 text-lg">
                Rapide, sécurisé et accessible partout en Afrique.
              </p>
            </div>

            {/* Avantages */}
            <div className="space-y-4">
              {[
                { icon: Zap, title: "Ultra rapide", desc: "Transferts en quelques secondes" },
                { icon: ShieldCheck, title: "100% sécurisé", desc: "Vos données sont protégées" },
                { icon: TrendingUp, title: "Frais réduits", desc: "Économisez sur chaque envoi" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{item.title}</p>
                    <p className="text-white/70 text-xs">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Rotateur multilingue en bas */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-white/10 dark:bg-slate-900/10 backdrop-blur-sm rounded-xl p-3"
          >
            <div className="text-white">
              <WelcomeRotator />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Côté droit : Formulaire ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <ImageWithFallback src={ayoLogo} alt="AYO" className="h-14 w-auto object-contain" />
          </div>

          {isBanned && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Compte temporairement suspendu</p>
                <p className="text-sm text-red-700 mt-1">
                  Votre compte a été suspendu par un administrateur. Veuillez contacter le support pour plus d'informations.
                </p>
                <a
                  href="mailto:contact@ayo-transfer.com"
                  className="inline-block mt-2 text-sm text-red-800 font-medium underline hover:no-underline"
                >
                  📧 contact@ayo-transfer.com
                </a>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-poppins font-bold text-foreground">
              Connexion
            </h2>
            <p className="text-muted-foreground">
              Accédez à votre portefeuille AYO
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setIsBanned(false); }}
                  disabled={isLoading}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setIsBanned(false); }}
                  disabled={isLoading}
                  required
                  className="pl-10 pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Bouton */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            {/* Séparateur "OU" */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">
                  OU
                </span>
              </div>
            </div>

            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/`,
                  },
                });
                if (error) toast.error('Erreur Google : ' + error.message);
              }}
              className="w-full h-11 border-border hover:bg-muted/50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </Button>
          </form>

          {/* Séparateur */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">
                Nouveau sur AYO ?
              </span>
            </div>
          </div>

          {/* Lien Register */}
          <Link to="/register">
            <Button
              variant="outline"
              className="w-full h-11 border-primary/30 text-primary hover:bg-primary/5"
            >
              Créer un compte gratuitement
            </Button>
          </Link>

          {/* Note sécurité */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Connexion sécurisée par AYO</span>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              En continuant, vous acceptez nos{' '}
              <Link to="/terms" className="text-primary hover:underline font-medium">
                Conditions d'utilisation
              </Link>
              {' '}et notre{' '}
              <Link to="/privacy" className="text-primary hover:underline font-medium">
                Politique de confidentialité
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}