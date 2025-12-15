import { useState } from 'react';
import { SurveyWithDetails, ReactionType } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ThumbsUp, ThumbsDown, Laugh, Frown, MessageCircle, Share2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface SurveyCardProps {
  survey: SurveyWithDetails;
  onVote: (surveyId: string, optionId: string) => void;
  onReact: (surveyId: string, reaction: ReactionType) => void;
  onComment: (surveyId: string, content: string) => void;
}

const reactionConfig: Record<ReactionType, { icon: typeof ThumbsUp; label: string; activeClass: string }> = {
  like: { icon: ThumbsUp, label: 'Like', activeClass: 'text-reaction-like bg-reaction-like/10' },
  dislike: { icon: ThumbsDown, label: 'Dislike', activeClass: 'text-reaction-dislike bg-reaction-dislike/10' },
  laugh: { icon: Laugh, label: 'Haha', activeClass: 'text-reaction-laugh bg-reaction-laugh/10' },
  sad: { icon: Frown, label: 'Sad', activeClass: 'text-reaction-sad bg-reaction-sad/10' },
};

export function SurveyCard({ survey, onVote, onReact, onComment }: SurveyCardProps) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const totalVotes = survey.options.reduce((sum, opt) => sum + opt.vote_count, 0);
  const hasVoted = survey.userVotes && survey.userVotes.length > 0;

  const getReactionCount = (type: ReactionType) => {
    return survey.reactions.filter(r => r.reaction === type).length;
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/survey/${survey.id}`;
    const subject = `Check out this survey: ${survey.title}`;
    const body = `I thought you might be interested in this survey:\n\n${survey.title}\n\n${shareUrl}`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success('Email client opened!');
  };

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    onComment(survey.id, commentText.trim());
    setCommentText('');
  };

  return (
    <Card variant="elevated" className="overflow-hidden animate-fade-in group hover:shadow-xl transition-all duration-300 rounded-2xl border-2 border-primary/10 hover:border-primary/30">
      {survey.image_url && (
        <div className="h-52 overflow-hidden relative">
          <img
            src={survey.image_url}
            alt={survey.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-3">
          {survey.preference && (
            <span className="text-xs font-semibold px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary shadow-sm">
              {survey.preference.icon} {survey.preference.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            {formatDistanceToNow(new Date(survey.created_at), { addSuffix: true })}
          </span>
        </div>
        <CardTitle className="text-xl leading-snug font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
          {survey.title}
        </CardTitle>
        {survey.description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{survey.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Survey Options */}
        <div className="space-y-3">
          {survey.options.map((option, index) => {
            const percentage = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
            const isVoted = survey.userVotes?.includes(option.id);
            const optionColors = [
              'from-primary/20 to-primary/5 border-primary/30',
              'from-accent/20 to-accent/5 border-accent/30',
              'from-secondary/30 to-secondary/10 border-secondary/50',
              'from-reaction-like/20 to-reaction-like/5 border-reaction-like/30',
            ];

            return (
              <button
                key={option.id}
                onClick={() => onVote(survey.id, option.id)}
                disabled={!user || (hasVoted && !survey.allow_multiple_answers)}
                className={cn(
                  'w-full relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
                  isVoted
                    ? 'border-primary bg-gradient-to-r from-primary/15 to-primary/5 shadow-md'
                    : `bg-gradient-to-r ${optionColors[index % optionColors.length]} hover:shadow-md`,
                  !user && 'opacity-60 cursor-not-allowed hover:scale-100'
                )}
              >
                {/* Progress bar background */}
                {hasVoted && (
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/25 to-primary/10 transition-all duration-700 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                
                <div className="relative flex items-center justify-between">
                  <span className="font-semibold text-foreground/90">{option.option_text}</span>
                  {hasVoted && (
                    <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {totalVotes > 0 && (
          <p className="text-center text-sm text-muted-foreground font-medium">
            🗳️ {totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast
          </p>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-2 pt-3 border-t border-primary/10">
          {(Object.keys(reactionConfig) as ReactionType[]).map((type) => {
            const config = reactionConfig[type];
            const Icon = config.icon;
            const count = getReactionCount(type);
            const isActive = survey.userReaction === type;

            return (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                onClick={() => onReact(survey.id, type)}
                className={cn(
                  'flex-1 gap-1.5 rounded-xl transition-all duration-200 hover:scale-105',
                  isActive && `${config.activeClass} shadow-sm font-semibold`
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'animate-bounce')} />
                <span className="text-xs font-medium">{count > 0 && count}</span>
              </Button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="flex-1 gap-2 rounded-xl hover:bg-accent/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-medium">{survey.comments.length} Comments</span>
            {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="flex-1 gap-2 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="font-medium">Share</span>
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-3 pt-4 border-t border-primary/10 animate-fade-in">
            {user && (
              <div className="flex gap-2">
                <Input
                  placeholder="Write a comment... 💬"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                  inputSize="sm"
                  className="rounded-xl border-2 border-primary/20 focus:border-primary/50"
                />
                <Button
                  size="icon-sm"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                  className="rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}

            {survey.comments.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {survey.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 rounded-xl bg-gradient-to-r from-muted/70 to-muted/40 text-sm border border-muted"
                  >
                    <p className="text-foreground/90">{comment.content}</p>
                    <span className="text-xs text-muted-foreground mt-1 block">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-xl">
                ✨ No comments yet. Be the first to share your thoughts!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
