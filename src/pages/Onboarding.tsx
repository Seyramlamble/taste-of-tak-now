import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreferences } from '@/hooks/usePreferences';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, ArrowRight } from 'lucide-react';

const categoryColors: Record<string, string> = {
  'Cooking': 'bg-category-cooking/10 border-category-cooking hover:bg-category-cooking/20',
  'Sports': 'bg-category-sports/10 border-category-sports hover:bg-category-sports/20',
  'Politics': 'bg-category-politics/10 border-category-politics hover:bg-category-politics/20',
  'Relationships': 'bg-category-relationships/10 border-category-relationships hover:bg-category-relationships/20',
  'Scandals': 'bg-category-scandals/10 border-category-scandals hover:bg-category-scandals/20',
  'Music': 'bg-category-music/10 border-category-music hover:bg-category-music/20',
  'Spirituality': 'bg-category-spirituality/10 border-category-spirituality hover:bg-category-spirituality/20',
  'Science': 'bg-category-science/10 border-category-science hover:bg-category-science/20',
};

export default function OnboardingPage() {
  const { preferences, savePreferences, loading } = usePreferences();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const togglePreference = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selectedIds.length === 0) return;
    
    setSaving(true);
    await savePreferences(selectedIds);
    setSaving(false);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="w-full max-w-2xl animate-slide-up">
        <Card variant="elevated">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-display text-gradient">
              What interests you?
            </CardTitle>
            <CardDescription className="text-base">
              Select your preferences to personalize your feed. You can change these anytime.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {preferences.map((pref) => {
                const isSelected = selectedIds.includes(pref.id);
                const colorClass = categoryColors[pref.name] || 'bg-muted border-border';
                
                return (
                  <button
                    key={pref.id}
                    onClick={() => togglePreference(pref.id)}
                    className={cn(
                      'relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300',
                      colorClass,
                      isSelected && 'ring-2 ring-primary ring-offset-2'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <span className="text-3xl mb-2">{pref.icon}</span>
                    <span className="font-medium text-sm">{pref.name}</span>
                  </button>
                );
              })}
            </div>

            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={handleContinue}
              disabled={selectedIds.length === 0 || saving}
            >
              {saving ? 'Saving...' : (
                <>
                  Continue to Dashboard
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Select at least one preference to continue
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
