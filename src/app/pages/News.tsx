import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Newspaper, TrendingUp, Globe, MapPin, ExternalLink, RefreshCw, Loader2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { newsApi, type NewsArticle } from "../../../utils/api";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} minute${min > 1 ? "s" : ""}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} heure${h > 1 ? "s" : ""}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d} jour${d > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function News() {
  const [activeTab, setActiveTab] = useState("all");
  const [activeRegion, setActiveRegion] = useState<"all" | "cameroun" | "monde">("all");
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await newsApi.list();
      setNews(res.news || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = news.filter((a) => {
    const matchesCategory = activeTab === "all" || a.category === activeTab;
    const matchesRegion = activeRegion === "all" || a.region === activeRegion;
    return matchesCategory && matchesRegion;
  });

  const NewsCard = ({ article }: { article: NewsArticle }) => {
    const Icon = article.category === "finance" ? TrendingUp : Newspaper;
    const hasContent = !!article.content && article.content.trim().length > 0;
    return (
      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-md border-orange-100 hover:shadow-xl transition-all">
        <CardHeader>
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge
              variant="secondary"
              className={article.category === "finance" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}
            >
              {article.tag || (article.category === "finance" ? "Finance" : "Général")}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {article.region === "cameroun" ? (<><MapPin className="w-3 h-3" />Cameroun</>) : (<><Globe className="w-3 h-3" />Monde</>)}
            </div>
          </div>
          <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-gray-600 dark:text-gray-400 mb-4">{article.description}</CardDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Icon className="w-4 h-4" />
              <span className="font-medium">{article.source}</span>
              <span>•</span>
              <span>{formatRelativeTime(article.publishedAt)}</span>
            </div>
            {hasContent && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setReadingArticle(article)}>
                Lire
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Actualités</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Restez informé des dernières nouvelles financières et économiques</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Rafraîchir
        </Button>
      </div>

      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border-orange-100">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="gap-2"><Newspaper className="w-4 h-4" />Toutes</TabsTrigger>
                <TabsTrigger value="finance" className="gap-2"><TrendingUp className="w-4 h-4" />Finance</TabsTrigger>
                <TabsTrigger value="general" className="gap-2"><Globe className="w-4 h-4" />Général</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-2">
              <Button variant={activeRegion === "all" ? "default" : "outline"} size="sm" onClick={() => setActiveRegion("all")}>
                Toutes les régions
              </Button>
              <Button variant={activeRegion === "cameroun" ? "default" : "outline"} size="sm" onClick={() => setActiveRegion("cameroun")} className="gap-1">
                <MapPin className="w-3 h-3" />Cameroun
              </Button>
              <Button variant={activeRegion === "monde" ? "default" : "outline"} size="sm" onClick={() => setActiveRegion("monde")} className="gap-1">
                <Globe className="w-3 h-3" />Monde
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="bg-white/80 dark:bg-slate-900/80 shadow-md border-orange-100 animate-pulse">
              <CardContent className="p-6 space-y-3">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-5 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-8 text-center text-red-700">
            <p className="font-semibold">Erreur de chargement</p>
            <p className="text-sm mt-1">{error}</p>
            <Button onClick={load} className="mt-3" size="sm">Réessayer</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border-orange-100">
          <CardContent className="py-12 text-center">
            <Newspaper className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Aucune actualité trouvée pour cette catégorie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((article) => <NewsCard key={article.id} article={article} />)}
        </div>
      )}

      {/* Modal de lecture */}
      {readingArticle && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setReadingArticle(null)}
        >
          <Card
            className="bg-white dark:bg-slate-900 max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className={readingArticle.category === "finance" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                      {readingArticle.tag || (readingArticle.category === "finance" ? "Finance" : "Général")}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      {readingArticle.region === "cameroun" ? (<><MapPin className="w-3 h-3" />Cameroun</>) : (<><Globe className="w-3 h-3" />Monde</>)}
                    </span>
                  </div>
                  <CardTitle className="text-xl leading-tight">{readingArticle.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {readingArticle.source} · {formatRelativeTime(readingArticle.publishedAt)}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setReadingArticle(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {readingArticle.content}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}