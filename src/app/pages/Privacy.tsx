import { Link } from 'react-router';
import { ArrowLeft, Shield } from 'lucide-react';
import { motion } from 'motion/react';

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border p-8 sm:p-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-poppins font-bold text-foreground">
                Politique de confidentialité
              </h1>
              <p className="text-sm text-muted-foreground">
                Dernière mise à jour : 19 octobre 2026
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none space-y-6 text-foreground/80">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">1. Introduction</h2>
              <p>
                AYO respecte votre vie privée. Cette politique explique comment nous collectons,
                utilisons et protégeons vos données personnelles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">2. Données collectées</h2>
              <p>Nous collectons les données suivantes :</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Identité</strong> : nom, email, numéro de téléphone.</li>
                <li><strong>Transactions</strong> : montants, dates, méthodes de paiement.</li>
                <li><strong>Données techniques</strong> : adresse IP, type d'appareil, logs de connexion.</li>
                <li><strong>Données KYC</strong> (si vous complétez la vérification) : pièce d'identité, selfie.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">3. Utilisation des données</h2>
              <p>Vos données sont utilisées pour :</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Traiter vos transactions et gérer votre compte.</li>
                <li>Prévenir la fraude et assurer la sécurité.</li>
                <li>Respecter nos obligations légales (KYC/AML).</li>
                <li>Améliorer nos services et votre expérience.</li>
                <li>Vous envoyer des notifications importantes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">4. Partage des données</h2>
              <p>Vos données peuvent être partagées avec :</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Opérateurs Mobile Money</strong> (MTN, Orange, etc.) pour traiter les transactions.</li>
                <li><strong>Autorités légales</strong> en cas d'obligation légale ou de fraude suspectée.</li>
                <li><strong>Prestataires techniques</strong> (Supabase, Resend) qui respectent le RGPD.</li>
              </ul>
              <p className="mt-2">
                <strong>Nous ne vendons jamais vos données</strong> à des tiers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">5. Sécurité</h2>
              <p>
                Nous utilisons des mesures de sécurité avancées :
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Chiffrement SSL/TLS pour toutes les communications.</li>
                <li>Mots de passe hashés avec PBKDF2 (600 000 itérations).</li>
                <li>Authentification JWT sécurisée.</li>
                <li>Sauvegardes régulières et chiffrées.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">6. Conservation des données</h2>
              <p>
                Vos données sont conservées aussi longtemps que votre compte est actif,
                et 5 ans après sa fermeture (obligation légale de conservation des données financières).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">7. Vos droits</h2>
              <p>Vous avez le droit de :</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Accéder</strong> à vos données personnelles.</li>
                <li><strong>Rectifier</strong> vos informations.</li>
                <li><strong>Supprimer</strong> votre compte (sous conditions légales).</li>
                <li><strong>Retirer</strong> votre consentement à tout moment.</li>
                <li><strong>Porter plainte</strong> auprès d'une autorité de protection des données.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">8. Cookies</h2>
              <p>
                AYO utilise des cookies essentiels pour maintenir votre session connectée.
                Nous n'utilisons pas de cookies publicitaires.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">9. Modifications</h2>
              <p>
                Cette politique peut être mise à jour. Les utilisateurs seront informés
                des changements importants par email ou notification.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">10. Contact</h2>
              <p>
                Pour exercer vos droits ou poser des questions :{" "}
                <a href="mailto:privacy@ayo-transfer.com" className="text-primary hover:underline">
                  privacy@ayo-transfer.com
                </a>
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}