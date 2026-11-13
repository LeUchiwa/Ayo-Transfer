import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { WelcomeRotator } from '../components/WelcomeRotator';
import { supabase } from '../../../utils/supabase/client';
import ayoLogo from '@/imports/AYO.png';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Veuillez entrer votre email');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setIsSent(true);
      toast.success('Email envoyé !');
    } catch (error) {
      toast.error('Erreur. Vérifiez votre email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Côté gauche : Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary via-primary to-cyan-600 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 dark:bg-slate-900/10 rounded-full -translate-y-48 translate-x-48" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 dark:bg-slate-900/5 rounded-full translate-y-40 -translate-x-40" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <ImageWithFallback src={ayoLogo} alt="AYO" className="h-10 w-auto object-contain" />
            <div>
              <p className="text-white font-poppins font-bold text-xl">AYO</p>
              <p className="text-white/70 text-xs">Transfert d'argent</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <h1 className="text-4xl font-poppins font-bold text-white leading-tight">
              Pas de panique. <br />
              On vous aide.
            </h1>
            <p className="text-white/80 text-lg">
              Récupérez l'accès à votre compte AYO en quelques secondes.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-white/10 dark:bg-slate-900/10 backdrop-blur-sm rounded-xl p-3"
          >
            <div className="text-white">
              <WelcomeRotator />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Côté droit : Formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex justify-center mb-8">
            <ImageWithFallback src={ayoLogo} alt="AYO" className="h-14 w-auto object-contain" />
          </div>

          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </Link>

          {!isSent ? (
            <>
              <div className="space-y-2 mb-8">
                <h2 className="text-3xl font-poppins font-bold text-foreground">
                  Mot de passe oublié ?
                </h2>
                <p className="text-muted-foreground">
                  Entrez votre email, nous vous enverrons un lien.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-10 h-11"
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Envoyer le lien'
                  )}
                </Button>
              </form>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-poppins font-bold text-foreground mb-2">
                Email envoyé !
              </h2>
              <p className="text-muted-foreground mb-6">
                Si un compte existe avec <strong>{email}</strong>, vous recevrez un lien.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full h-11 border-primary/30 text-primary">
                  Retour à la connexion
                </Button>
              </Link>
            </motion.div>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Vos données sont protégées</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}