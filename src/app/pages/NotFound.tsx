import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import { motion } from "motion/react";

export function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
          className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Search className="w-12 h-12 text-primary" />
        </motion.div>

        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          Page introuvable
        </h2>
        <p className="text-muted-foreground mb-8">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white">
              <Home className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Page précédente
          </Button>
        </div>
      </motion.div>
    </div>
  );
}