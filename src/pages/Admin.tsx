import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Shield, 
  Sparkles, 
  Globe, 
  Plus, 
  Trash2, 
  Send, 
  Loader2, 
  RefreshCw,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle
} from 'lucide-react';

interface SurveySuggestion {
  title: string;
  description: string;
  options: string[];
  imagePrompt: string;
  category: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

const countries = [
  { code: 'all', name: 'Global' },
  { code: 'US', name: 'United States' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'MX', name: 'Mexico' },
];

const categoryMap: Record<string, string> = {
  'cooking': 'Cooking',
  'sports': 'Sports',
  'politics': 'Politics',
  'relationships': 'Relationships',
  'scandals': 'Scandals',
  'music': 'Music',
  'spirituality': 'Spirituality',
  'science': 'Science',
  'fun': 'Fun',
};

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { preferences } = usePreferences();
  const navigate = useNavigate();
  
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [suggestions, setSuggestions] = useState<SurveySuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  
  // Manual survey creation
  const [manualSurvey, setManualSurvey] = useState({
    title: '',
    description: '',
    options: ['', ''],
    preferenceId: '',
    targetCountry: '',
    allowMultiple: false,
    imageUrl: ''
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-survey-suggestions', {
        body: { country: selectedCountry }
      });

      if (error) throw error;

      if (data?.suggestions) {
        setSuggestions(data.suggestions.map((s: SurveySuggestion) => ({
          ...s,
          isGeneratingImage: false
        })));
        toast.success('Generated 5 survey suggestions!');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Failed to generate suggestions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async (index: number) => {
    const suggestion = suggestions[index];
    setSuggestions(prev => prev.map((s, i) => 
      i === index ? { ...s, isGeneratingImage: true } : s
    ));

    try {
      const { data, error } = await supabase.functions.invoke('generate-survey-image', {
        body: { prompt: suggestion.imagePrompt }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setSuggestions(prev => prev.map((s, i) => 
          i === index ? { ...s, imageUrl: data.imageUrl, isGeneratingImage: false } : s
        ));
        toast.success('Image generated!');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image.');
      setSuggestions(prev => prev.map((s, i) => 
        i === index ? { ...s, isGeneratingImage: false } : s
      ));
    }
  };

  const publishSuggestion = async (suggestion: SurveySuggestion) => {
    setIsPublishing(suggestion.title);
    try {
      // Find matching preference
      const categoryName = categoryMap[suggestion.category.toLowerCase()] || suggestion.category;
      const preference = preferences.find(p => 
        p.name.toLowerCase() === categoryName.toLowerCase()
      );

      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert({
          title: suggestion.title,
          description: suggestion.description,
          author_id: user!.id,
          preference_id: preference?.id || null,
          target_country: selectedCountry === 'all' ? null : selectedCountry,
          image_url: suggestion.imageUrl || null,
          is_published: true,
          allow_multiple_answers: false
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      // Create options
      const optionsToInsert = suggestion.options.map(option => ({
        survey_id: survey.id,
        option_text: option
      }));

      const { error: optionsError } = await supabase
        .from('survey_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      toast.success('Survey published successfully!');
      setSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
    } catch (error) {
      console.error('Error publishing survey:', error);
      toast.error('Failed to publish survey.');
    } finally {
      setIsPublishing(null);
    }
  };

  const publishManualSurvey = async () => {
    if (!manualSurvey.title.trim()) {
      toast.error('Please enter a survey title');
      return;
    }
    
    const validOptions = manualSurvey.options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }

    try {
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert({
          title: manualSurvey.title,
          description: manualSurvey.description || null,
          author_id: user!.id,
          preference_id: manualSurvey.preferenceId || null,
          target_country: manualSurvey.targetCountry === 'all' ? null : (manualSurvey.targetCountry || null),
          image_url: manualSurvey.imageUrl || null,
          is_published: true,
          allow_multiple_answers: manualSurvey.allowMultiple
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      const optionsToInsert = validOptions.map(option => ({
        survey_id: survey.id,
        option_text: option
      }));

      const { error: optionsError } = await supabase
        .from('survey_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      toast.success('Survey created and published!');
      setManualSurvey({
        title: '',
        description: '',
        options: ['', ''],
        preferenceId: '',
        targetCountry: '',
        allowMultiple: false,
        imageUrl: ''
      });
    } catch (error) {
      console.error('Error creating survey:', error);
      toast.error('Failed to create survey.');
    }
  };

  const addOption = () => {
    if (manualSurvey.options.length < 6) {
      setManualSurvey(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (manualSurvey.options.length > 2) {
      setManualSurvey(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updateOption = (index: number, value: string) => {
    setManualSurvey(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage surveys and content</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8 space-y-8">
        {/* AI Survey Suggestions */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>AI Survey Suggestions</CardTitle>
                  <CardDescription>Generate engaging survey ideas with AI</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label>Target Country</Label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger>
                      <Globe className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map(country => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={generateSuggestions}
                    disabled={isGenerating}
                    className="w-full sm:w-auto"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate 5 Suggestions
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Suggestions Grid */}
              {suggestions.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {suggestions.map((suggestion, index) => (
                    <Card key={index} variant="elevated" className="overflow-hidden">
                      {suggestion.imageUrl ? (
                        <div className="aspect-video bg-muted">
                          <img
                            src={suggestion.imageUrl}
                            alt={suggestion.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-muted flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateImage(index)}
                            disabled={suggestion.isGeneratingImage}
                          >
                            {suggestion.isGeneratingImage ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Generate Image
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary mb-2">
                            {categoryMap[suggestion.category.toLowerCase()] || suggestion.category}
                          </span>
                          <h3 className="font-semibold line-clamp-2">{suggestion.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {suggestion.description}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {suggestion.options.map((option, i) => (
                            <div key={i} className="text-sm px-2 py-1 bg-muted rounded">
                              {option}
                            </div>
                          ))}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => publishSuggestion(suggestion)}
                          disabled={isPublishing === suggestion.title}
                        >
                          {isPublishing === suggestion.title ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Publish Survey
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Manual Survey Creation */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Create Survey Manually</CardTitle>
                  <CardDescription>Design your own custom survey</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4 md:col-span-2">
                  <div>
                    <Label>Survey Question *</Label>
                    <Input
                      placeholder="What's your favorite...?"
                      value={manualSurvey.title}
                      onChange={e => setManualSurvey(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Textarea
                      placeholder="Add context or explanation..."
                      value={manualSurvey.description}
                      onChange={e => setManualSurvey(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>

                <div>
                  <Label>Category</Label>
                  <Select 
                    value={manualSurvey.preferenceId} 
                    onValueChange={v => setManualSurvey(prev => ({ ...prev, preferenceId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {preferences.map(pref => (
                        <SelectItem key={pref.id} value={pref.id}>
                          {pref.icon} {pref.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Target Country</Label>
                  <Select 
                    value={manualSurvey.targetCountry} 
                    onValueChange={v => setManualSurvey(prev => ({ ...prev, targetCountry: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {countries.slice(1).map(country => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>Image URL (optional)</Label>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={manualSurvey.imageUrl}
                    onChange={e => setManualSurvey(prev => ({ ...prev, imageUrl: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <Switch
                    id="allowMultiple"
                    checked={manualSurvey.allowMultiple}
                    onCheckedChange={v => setManualSurvey(prev => ({ ...prev, allowMultiple: v }))}
                  />
                  <Label htmlFor="allowMultiple">Allow multiple answers</Label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Answer Options *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOption}
                    disabled={manualSurvey.options.length >= 6}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {manualSurvey.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={e => updateOption(index, e.target.value)}
                      />
                      {manualSurvey.options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={publishManualSurvey} className="w-full sm:w-auto">
                <CheckCircle className="w-4 h-4 mr-2" />
                Create & Publish Survey
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
