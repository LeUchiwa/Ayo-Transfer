import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  Home,
  Send,
  History,
  Menu,
  Wallet,
  LogOut,
  User,
  Bell,
  Newspaper,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useAuth } from "../contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { AuthGuard } from "./AuthGuard";
import { StaticBackground } from "./StaticBackground";
import { Badge } from "./ui/badge";
import ayoLogo from "@/imports/AYO.png";
import { useUnreadNotificationsCount } from "../hooks/useUnreadNotificationsCount";
import { usePendingTransactionsCount } from "../hooks/usePendingTransactionsCount";
import { ThemeToggle } from "./ThemeToggle";
import { PWAInstallMenuItem } from "./PWAInstallMenuItem";

export function ProtectedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const unreadCount = useUnreadNotificationsCount();
  const pendingCount = usePendingTransactionsCount();

  const navigation = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Transfert", href: "/transfer", icon: Send },
    { name: "Portefeuille", href: "/wallet", icon: Wallet },
    { name: "KYC", href: "/kyc", icon: ShieldCheck },
    { name: "Historique", href: "/history", icon: History, badge: pendingCount },
    { name: "Notifications", href: "/notifications", icon: Bell, badge: unreadCount },
    { name: "Actualités", href: "/news", icon: Newspaper },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      navigate("/login", { replace: true });
    }
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen relative">
        <StaticBackground />
        {/* Header */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-teal-100 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo AYO */}
              <Link to="/" className="flex items-center gap-3">
                <img
                  src={ayoLogo}
                  alt="AYO - Transfert d'argent"
                  className="h-10 w-auto object-contain"
                />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-2">
                {navigation.map((item) => (
                  <Link key={item.name} to={item.href}>
                    <Button
                      variant={isActive(item.href) ? "default" : "ghost"}
                      className="gap-2 relative"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                      {item.badge > 0 && (
  <Badge className="ml-1 bg-red-500 text-white px-1.5 py-0.5 text-xs">
    {item.badge}
  </Badge>
)}
                    </Button>
                  </Link>
                ))}

                {/* ✅ Avatar amélioré */}
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="rounded-full gap-2 px-3">
                      <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <span className="hidden lg:inline text-sm font-medium max-w-[100px] truncate">
                        {user?.name}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{user?.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal truncate">
                          {user?.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="w-4 h-4 mr-2" />
                      Mon profil
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <PWAInstallMenuItem />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>

              {/* Mobile Navigation */}
              <div className="md:hidden flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{user?.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal truncate">
                          {user?.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="w-4 h-4 mr-2" />
                      Mon profil
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <PWAInstallMenuItem />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <div className="flex flex-col gap-4 mt-8">
                      {navigation.map((item) => (
                        <Link key={item.name} to={item.href}>
                          <Button
                            variant={isActive(item.href) ? "default" : "ghost"}
                            className="w-full justify-start gap-2 relative"
                          >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                            {item.badge > 0 && (
  <Badge className="ml-auto bg-red-500 text-white px-1.5 py-0.5 text-xs">
    {item.badge}
  </Badge>
)}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  );
}