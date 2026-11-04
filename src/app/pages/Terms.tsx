import { Link } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { motion } from 'motion/react';

export function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Retour */}
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
          className="bg-white rounded-2xl shadow-sm border border-border p-8 sm:p-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-poppins font-bold text-foreground">
                Conditions d'utilisation
              </h1>
              <p className="text-sm text-muted-foreground">
                Dernière mise à jour : 19 octobre 2026
              </p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none space-y-6 text-foreground/80">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptation des conditions</h2>
              <p>
                En créant un compte sur AYO, vous acceptez les présentes conditions d'utilisation.
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">2. Description du service</h2>
              <p>
                AYO est une application de transfert d'argent permettant d'envoyer et de recevoir
                des fonds via des services de paiement mobile (Mobile Money, wallets digitaux, etc.).
                Les transferts sont soumis aux frais affichés au moment de la transaction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">3. Inscription et compte</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Vous devez être âgé de 18 ans minimum.</li>
                <li>Vous vous engagez à fournir des informations exactes et à jour.</li>
                <li>Vous êtes responsable de la confidentialité de vos identifiants.</li>
                <li>Un seul compte par personne est autorisé.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">4. Utilisation acceptable</h2>
              <p>Il est interdit d'utiliser AYO pour :</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Le blanchiment d'argent ou le financement du terrorisme.</li>
                <li>La fraude, l'usurpation d'identité ou les activités illégales.</li>
                <li>Contourner les limites de transfert établies.</li>
                <li>Perturber le fonctionnement de l'application.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">5. Frais et tarifs</h2>
              <p>
                Les frais de transfert sont affichés avant chaque transaction. AYO se réserve le droit
                de modifier ses tarifs avec un préavis de 30 jours.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">6. Sécurité et fraude</h2>
              <p>
                AYO met en œuvre des mesures de sécurité pour protéger vos fonds et vos données.
                Nous nous réservons le droit de suspendre un compte en cas de suspicion de fraude
                ou d'activité suspecte.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">7. Limitation de responsabilité</h2>
              <p>
                AYO ne pourra être tenu responsable des retards ou échecs de transaction dus à
                des problèmes techniques des opérateurs Mobile Money, des réseaux ou de force majeure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">8. Résiliation</h2>
              <p>
                Vous pouvez fermer votre compte à tout moment. AYO peut suspendre ou résilier un compte
                en cas de violation des présentes conditions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">9. Modifications</h2>
              <p>
                AYO se réserve le droit de modifier ces conditions. Les utilisateurs seront informés
                par email ou notification dans l'application.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">10. Contact</h2>
              <p>
                Pour toute question, contactez-nous à :{" "}
                <a href="mailto:contact@ayo-transfer.com" className="text-primary hover:underline">
                  contact@ayo-transfer.com
                </a>
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}