#!/usr/bin/env bash
set -euo pipefail

# 1. Fix PayPage.tsx pour attendre le chargement de l'auth
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/pages/PayPage.tsx")
src = p.read_text(encoding="utf-8")

# On récupère isLoading de useAuth
old_hook = "const { user, isAuthenticated } = useAuth();"
new_hook = "const { user, isAuthenticated, isLoading: authLoading } = useAuth();"
if old_hook in src:
    src = src.replace(old_hook, new_hook)

# On met à jour le useEffect pour attendre la fin du chargement
old_effect = """  useEffect(() => {
    // Si l'utilisateur n'est pas connecté, on le redirige vers la connexion
    if (!isAuthenticated) {
      navigate(`/login?redirect=/pay/${userId}`, { replace: true });
      return;
    }"""

new_effect = """  useEffect(() => {
    // On attend que l'authentification soit chargée pour éviter les redirections prématurées
    if (authLoading) return;

    // Si l'utilisateur n'est pas connecté, on le redirige vers la connexion
    if (!isAuthenticated) {
      navigate(`/login?redirect=/pay/${userId}`, { replace: true });
      return;
    }"""

if old_effect in src:
    src = src.replace(old_effect, new_effect)

# On met aussi authLoading dans les dépendances du useEffect
old_deps = "}, [userId, isAuthenticated, navigate]);"
new_deps = "}, [userId, isAuthenticated, authLoading, navigate]);"
if old_deps in src:
    src = src.replace(old_deps, new_deps)

p.write_text(src, encoding="utf-8")
print("✅ PayPage.tsx : attend la fin du chargement de la session.")
PY

# 2. Fix Login.tsx pour lire correctement le paramètre redirect
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/pages/Login.tsx")
src = p.read_text(encoding="utf-8")

old_effect = """  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);"""

new_effect = """  useEffect(() => {
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirect") || "/";
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate]);"""

if old_effect in src:
    src = src.replace(old_effect, new_effect)
    p.write_text(src, encoding="utf-8")
    print("✅ Login.tsx : lit et respecte le paramètre redirect.")
else:
    print("⚠️ Bloc useEffect de Login introuvable (vérification manuelle nécessaire).")
PY
