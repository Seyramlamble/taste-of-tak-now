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
    <Card variant="elevated" className="overflow-hidden animate-fade-in">
      {survey.image_url && (
        <div className="h-48 overflow-hidden">
          <img
            src={survey.image_url}
            alt={survey.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          {survey.preference && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
              {survey.preference.icon} {survey.preference.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(survey.created_at), { addSuffix: true })}
          </span>
        </div>
        <CardTitle className="text-xl leading-snug">{survey.title}</CardTitle>
        {survey.description && (
          <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Survey Options */}
        <div className="space-y-2">
          {survey.options.map((option) => {
            const percentage = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
            const isVoted = survey.userVotes?.includes(option.id);

            return (
              <button
                key={option.id}
                onClick={() => onVote(survey.id, option.id)}
                disabled={!user || (hasVoted && !survey.allow_multiple_answers)}
                className={cn(
                  'w-full relative overflow-hidden rounded-lg border-2 p-3 text-left transition-all duration-300',
                  isVoted
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  !user && 'opacity-60 cursor-not-allowed'
                )}
              >
                {/* Progress bar background */}
                {hasVoted && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                
                <div className="relative flex items-center justify-between">
                  <span className="font-medium">{option.option_text}</span>
                  {hasVoted && (
                    <span className="text-sm font-semibold text-primary">
                      {percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {totalVotes > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </p>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {(Object.keys(reactionConfig) as ReactionType[]).map((type) => {
            const config = reactionConfig[type];
            const Icon = config.icon;
            const count = getReactionCount(type);
            const isActive = survey.userReaction === type;

            return (
              <Button
                key={type}
                variant="reaction"
                size="sm"
                onClick={() => onReact(survey.id, type)}
                className={cn(
                  'flex-1 gap-1',
                  isActive && config.activeClass
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs">{count > 0 && count}</span>
              </Button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="flex-1 gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {survey.comments.length} Comments
            {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="flex-1 gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-3 pt-3 border-t animate-slide-up">
            {user && (
              <div className="flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                  inputSize="sm"
                />
                <Button
                  size="icon-sm"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
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
                    className="p-3 rounded-lg bg-muted/50 text-sm"
                  >
                    <p>{comment.content}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No comments yet. Be the first!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
