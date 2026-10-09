import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Home, Users, Copy, Settings, ShieldAlert, LogOut, User } from "lucide-react"
import { cn } from "@/utils"
import { useAuth } from "../../services/authContext"

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser, isAdmin, logout } = useAuth()
  
  const navItems = [
    { label: "Галерея", path: "/", icon: Home },
    { label: "Семейное древо", path: "/family-tree", icon: Users },
    { label: "Управление дубликатами", path: "/duplicates", icon: Copy },
    { label: "Настройки", path: "/settings", icon: Settings },
  ]
  
  if (isAdmin) {
    navItems.push({ label: "Админ панель", path: "/admin", icon: ShieldAlert })
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card/50 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-4 py-6 border-b">
            <h1 className="font-bold text-xl text-primary">Media Cataloger</h1>
          </div>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors",
                    isActive 
                      ? "bg-primary/20 text-primary font-medium" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        
        {/* User Profile / Status Bar Area */}
        <div className="p-4 border-t bg-background/50">
          {/* StatusBar component will be injected or used here later */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <User size={16} />
              </div>
              {currentUser?.username || 'User'}
            </div>
            <button 
              className="text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
          
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary w-1/3 rounded-full" />
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">Сканирование... 33%</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Topbar */}
        <header className="h-14 border-b bg-card/50 flex items-center px-4 md:hidden">
          <h1 className="font-bold text-lg text-primary">Media Cataloger</h1>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
