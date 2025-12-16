import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Plus, 
  Loader2, 
  ArrowLeft,
  Trash2,
  Link as LinkIcon,
  Mail,
  Copy,
  Check
} from 'lucide-react';
import { SurveyCard } from '@/components/SurveyCard';
import type { Group, SurveyWithDetails } from '@/types/database';

export default function GroupSurveys() {
  const { groupId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { preferences } = usePreferences();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [surveys, setSurveys] = useState<SurveyWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [newSurvey, setNewSurvey] = useState({
    title: '',
    description: '',
    options: ['', ''],
    preferenceId: '',
    allowMultiple: false,
    isPublicLink: false
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && groupId) {
      fetchGroupAndSurveys();
    }
  }, [user, groupId]);

  const fetchGroupAndSurveys = async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch surveys for this group
      const { data: surveysData, error: surveysError } = await supabase
        .from('surveys')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (surveysError) throw surveysError;

      // Fetch options for each survey
      const surveysWithDetails = await Promise.all(
        (surveysData || []).map(async (survey) => {
          const { data: options } = await supabase
            .from('survey_options')
            .select('*')
            .eq('survey_id', survey.id);

          const { data: reactions } = await supabase
            .from('reactions')
            .select('*')
            .eq('survey_id', survey.id);

          const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('survey_id', survey.id);

          return {
            ...survey,
            options: options || [],
            reactions: reactions || [],
            comments: comments || []
          } as SurveyWithDetails;
        })
      );

      setSurveys(surveysWithDetails);
    } catch (error) {
      console.error('Error fetching group:', error);
      toast.error('Failed to load group');
      navigate('/groups');
    } finally {
      setIsLoading(false);
    }
  };

  const createSurvey = async () => {
    if (!newSurvey.title.trim()) {
      toast.error('Please enter a survey title');
      return;
    }

    const validOptions = newSurvey.options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }

    setIsCreating(true);
    try {
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert({
          title: newSurvey.title,
          description: newSurvey.description || null,
          author_id: user!.id,
          group_id: groupId,
          preference_id: newSurvey.preferenceId || null,
          is_published: true,
          is_public_link: newSurvey.isPublicLink,
          allow_multiple_answers: newSurvey.allowMultiple
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

      toast.success('Survey created!');
      setCreateDialogOpen(false);
      setNewSurvey({
        title: '',
        description: '',
        options: ['', ''],
        preferenceId: '',
        allowMultiple: false,
        isPublicLink: false
      });
      fetchGroupAndSurveys();
    } catch (error) {
      console.error('Error creating survey:', error);
      toast.error('Failed to create survey');
    } finally {
      setIsCreating(false);
    }
  };

  const addOption = () => {
    if (newSurvey.options.length < 6) {
      setNewSurvey(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (newSurvey.options.length > 2) {
      setNewSurvey(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updateOption = (index: number, value: string) => {
    setNewSurvey(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const getShareLink = (surveyId: string) => {
    return `${window.location.origin}/#/survey/${surveyId}`;
  };

  const copyLink = async () => {
    if (selectedSurveyId) {
      await navigator.clipboard.writeText(getShareLink(selectedSurveyId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied!');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/groups')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-xl">{group.name}</h1>
              <p className="text-sm text-muted-foreground capitalize">{group.type} surveys</p>
            </div>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Survey
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Survey for {group.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Survey Question *</Label>
                  <Input
                    placeholder="What's your favorite...?"
                    value={newSurvey.title}
                    onChange={e => setNewSurvey(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Add context..."
                    value={newSurvey.description}
                    onChange={e => setNewSurvey(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                
                <div>
                  <Label>Category</Label>
                  <Select 
                    value={newSurvey.preferenceId} 
                    onValueChange={v => setNewSurvey(prev => ({ ...prev, preferenceId: v }))}
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

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="allowMultiple"
                      checked={newSurvey.allowMultiple}
                      onCheckedChange={v => setNewSurvey(prev => ({ ...prev, allowMultiple: v }))}
                    />
                    <Label htmlFor="allowMultiple">Allow multiple answers</Label>
                  </div>
                  
                  {group.type === 'company' && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="isPublicLink"
                        checked={newSurvey.isPublicLink}
                        onCheckedChange={v => setNewSurvey(prev => ({ ...prev, isPublicLink: v }))}
                      />
                      <Label htmlFor="isPublicLink">Allow public link access (for customers)</Label>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Answer Options *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addOption}
                      disabled={newSurvey.options.length >= 6}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newSurvey.options.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={e => updateOption(index, e.target.value)}
                        />
                        {newSurvey.options.length > 2 && (
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

                <Button onClick={createSurvey} disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Create Survey'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 lg:p-8">
        {surveys.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="font-semibold text-lg mb-2">No surveys yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a survey for your {group.type} group
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Survey
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {surveys.map(survey => (
              <div key={survey.id} className="relative">
                <SurveyCard survey={survey} />
                {group.type === 'company' && survey.is_public_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-4 right-4"
                    onClick={() => {
                      setSelectedSurveyId(survey.id);
                      setShareDialogOpen(true);
                    }}
                  >
                    <LinkIcon className="w-4 h-4 mr-1" />
                    Share
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Survey with Customers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Public Link</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={selectedSurveyId ? getShareLink(selectedSurveyId) : ''}
                />
                <Button onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Anyone with this link can view and respond to the survey
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
