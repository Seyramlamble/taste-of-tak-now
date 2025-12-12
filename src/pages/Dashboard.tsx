import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { useSurveys } from '@/hooks/useSurveys';
import { SurveyCard } from '@/components/SurveyCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  MessageSquare, 
  LogOut, 
  Settings, 
  Shield, 
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

const categoryColors: Record<string, string> = {
  'Cooking': 'bg-category-cooking text-primary-foreground',
  'Sports': 'bg-category-sports text-primary-foreground',
  'Politics': 'bg-category-politics text-primary-foreground',
  'Relationships': 'bg-category-relationships text-foreground',
  'Scandals': 'bg-category-scandals text-primary-foreground',
  'Music': 'bg-category-music text-primary-foreground',
  'Spirituality': 'bg-category-spirituality text-primary-foreground',
  'Science': 'bg-category-science text-primary-foreground',
};

export default function DashboardPage() {
  const { user, profile, isAdmin, signOut, loading: authLoading } = useAuth();
  const { preferences, userPreferences, loading: prefLoading } = usePreferences();
  const { surveys, loading: surveysLoading, fetchSurveys, vote, react, addComment } = useSurveys();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (userPreferences.length > 0) {
      fetchSurveys(activeCategory ? [activeCategory] : userPreferences);
    } else if (!prefLoading && userPreferences.length === 0) {
      fetchSurveys();
    }
  }, [userPreferences, activeCategory, prefLoading]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const userSelectedPreferences = preferences.filter(p => userPreferences.includes(p.id));

  if (authLoading || prefLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">PulseVote</span>
        </Link>
        <div className="w-10" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-72 bg-card border-r z-50 transition-transform duration-300',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">PulseVote</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Info */}
          <div className="mb-6 p-4 rounded-xl bg-muted/50">
            <p className="font-medium truncate">{profile?.display_name || 'User'}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Interests
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                  activeCategory === null
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <span>📰</span>
                <span className="font-medium">All Topics</span>
              </button>
              {userSelectedPreferences.map((pref) => (
                <button
                  key={pref.id}
                  onClick={() => setActiveCategory(pref.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                    activeCategory === pref.id
                      ? categoryColors[pref.name] || 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <span>{pref.icon}</span>
                  <span className="font-medium">{pref.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t space-y-1">
            <Link to="/onboarding">
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Settings className="w-4 h-4" />
                Manage Preferences
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/admin">
                <Button variant="ghost" className="w-full justify-start gap-3 text-primary">
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 lg:pt-0">
        <div className="max-w-2xl mx-auto p-4 lg:p-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold mb-6">
            {activeCategory
              ? userSelectedPreferences.find(p => p.id === activeCategory)?.name || 'Feed'
              : 'Your Feed'}
          </h1>

          {surveysLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-64 rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : surveys.length > 0 ? (
            <div className="space-y-6">
              {surveys.map((survey) => (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  onVote={vote}
                  onReact={react}
                  onComment={addComment}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No surveys yet in this category.
              </p>
              <p className="text-sm text-muted-foreground">
                Check back later for new content!
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
