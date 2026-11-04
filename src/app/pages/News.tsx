import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Newspaper, TrendingUp, Globe, MapPin, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";

type NewsArticle = {
  id: number;
  category: "finance" | "general";
  region: "cameroun" | "monde";
  title: string;
  description: string;
  source: string;
  time: string;
  image?: string;
  tag?: string;
};

const mockNews: NewsArticle[] = [
  {
    id: 1,
    category: "finance",
    region: "cameroun",
    title: "La Banque Centrale annonce de nouvelles mesures pour le secteur financier",
    description: "La BEAC met en place des initiatives pour moderniser les services bancaires et encourager l'inclusion financière au Cameroun.",
    source: "Investir au Cameroun",
    time: "Il y a 2 heures",
    tag: "Économie",
  },
  {
    id: 2,
    category: "finance",
    region: "cameroun",
    title: "Mobile Money : Une croissance de 45% des transactions en 2026",
    description: "Les services de transfert d'argent mobile connaissent une expansion remarquable avec MTN et Orange en tête.",
    source: "Business in Cameroon",
    time: "Il y a 5 heures",
    tag: "Fintech",
  },
  {
    id: 3,
    category: "general",
    region: "cameroun",
    title: "Yaoundé accueille le sommet africain des technologies financières",
    description: "Plus de 500 participants attendus pour discuter de l'avenir des paiements digitaux en Afrique centrale.",
    source: "CameroonWeb",
    time: "Hier",
    tag: "Événement",
  },
  {
    id: 4,
    category: "finance",
    region: "monde",
    title: "Les marchés africains attirent les investisseurs internationaux",
    description: "L'Afrique subsaharienne enregistre une hausse des investissements dans le secteur de la fintech.",
    source: "Bloomberg Africa",
    time: "Il y a 1 jour",
    tag: "Investissement",
  },
  {
    id: 5,
    category: "finance",
    region: "monde",
    title: "Le franc CFA face aux défis de la digitalisation",
    description: "Les experts débattent de l'impact des monnaies numériques sur l'économie de la zone franc.",
    source: "Jeune Afrique",
    time: "Il y a 2 jours",
    tag: "Analyse",
  },
  {
    id: 6,
    category: "general",
    region: "cameroun",
    title: "Lancement d'une nouvelle plateforme de paiement en ligne",
    description: "Une startup camerounaise dévoile sa solution innovante pour faciliter les transactions e-commerce.",
    source: "237online",
    time: "Il y a 3 jours",
    tag: "Innovation",
  },
  {
    id: 7,
    category: "finance",
    region: "monde",
    title: "L'inflation en zone CEMAC reste maîtrisée au premier trimestre",
    description: "Les données économiques montrent une stabilité des prix dans la région malgré les tensions mondiales.",
    source: "Financial Afrik",
    time: "Il y a 3 jours",
    tag: "Économie",
  },
  {
    id: 8,
    category: "general",
    region: "cameroun",
    title: "Formation gratuite en littératie financière pour les jeunes",
    description: "Le gouvernement lance un programme d'éducation financière dans les écoles secondaires.",
    source: "Cameroon Tribune",
    time: "Il y a 4 jours",
    tag: "Éducation",
  },
];

export function News() {
  const [activeTab, setActiveTab] = useState("all");
  const [activeRegion, setActiveRegion] = useState<"all" | "cameroun" | "monde">("all");

  const filteredNews = mockNews.filter((article) => {
    const matchesCategory =
      activeTab === "all" || article.category === activeTab;
    const matchesRegion =
      activeRegion === "all" || article.region === activeRegion;
    return matchesCategory && matchesRegion;
  });

  const NewsCard = ({ article }: { article: NewsArticle }) => {
    const categoryIcons = {
      finance: TrendingUp,
      general: Newspaper,
    };
    const Icon = categoryIcons[article.category];

    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-md border-orange-100 hover:shadow-xl transition-all cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge
              variant="secondary"
              className={
                article.category === "finance"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }
            >
              {article.tag}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              {article.region === "cameroun" ? (
                <>
                  <MapPin className="w-3 h-3" />
                  Cameroun
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  Monde
                </>
              )}
            </div>
          </div>
          <CardTitle className="text-lg leading-tight">
            {article.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-gray-600 mb-4">
            {article.description}
          </CardDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Icon className="w-4 h-4" />
              <span className="font-medium">{article.source}</span>
              <span>•</span>
              <span>{article.time}</span>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              Lire
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Actualités</h2>
        <p className="text-gray-600 mt-1">
          Restez informé des dernières nouvelles financières et économiques
        </p>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Category Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="gap-2">
                  <Newspaper className="w-4 h-4" />
                  Toutes
                </TabsTrigger>
                <TabsTrigger value="finance" className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Finance
                </TabsTrigger>
                <TabsTrigger value="general" className="gap-2">
                  <Globe className="w-4 h-4" />
                  Général
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Region Filter */}
            <div className="flex gap-2">
              <Button
                variant={activeRegion === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveRegion("all")}
              >
                Toutes les régions
              </Button>
              <Button
                variant={activeRegion === "cameroun" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveRegion("cameroun")}
                className="gap-1"
              >
                <MapPin className="w-3 h-3" />
                Cameroun
              </Button>
              <Button
                variant={activeRegion === "monde" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveRegion("monde")}
                className="gap-1"
              >
                <Globe className="w-3 h-3" />
                Monde
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredNews.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>

      {filteredNews.length === 0 && (
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
          <CardContent className="py-12 text-center">
            <Newspaper className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucune actualité trouvée pour cette catégorie</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
