import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Survey, SurveyOption, SurveyWithDetails, ReactionType, Profile, Preference, Reaction, Comment } from '@/types/database';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useSurveys() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<SurveyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSurveys = useCallback(async (preferenceIds?: string[]) => {
    setLoading(true);
    try {
      let query = supabase
        .from('surveys')
        .select(`
          *,
          options:survey_options(*),
          reactions(*),
          comments(*),
          preference:preferences(*),
          author:profiles(*)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (preferenceIds && preferenceIds.length > 0) {
        query = query.in('preference_id', preferenceIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user votes if logged in
      let userVotesMap: Record<string, string[]> = {};
      if (user) {
        const { data: votesData } = await supabase
          .from('user_votes')
          .select('survey_id, option_id')
          .eq('user_id', user.id);

        if (votesData) {
          votesData.forEach(vote => {
            if (!userVotesMap[vote.survey_id]) {
              userVotesMap[vote.survey_id] = [];
            }
            userVotesMap[vote.survey_id].push(vote.option_id);
          });
        }
      }

      const processedSurveys: SurveyWithDetails[] = (data || []).map((survey: any) => ({
        ...survey,
        options: survey.options || [],
        reactions: survey.reactions || [],
        comments: survey.comments || [],
        preference: survey.preference,
        author: survey.author,
        userVotes: userVotesMap[survey.id] || [],
        userReaction: user ? survey.reactions?.find((r: Reaction) => r.user_id === user.id)?.reaction : null
      }));

      setSurveys(processedSurveys);
    } catch (error: any) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const vote = async (surveyId: string, optionId: string) => {
    if (!user) {
      toast.error('Please sign in to vote');
      return;
    }

    try {
      // Check if user already voted on this option
      const survey = surveys.find(s => s.id === surveyId);
      if (!survey) return;

      const hasVotedOnOption = survey.userVotes?.includes(optionId);
      if (hasVotedOnOption) {
        toast.info('You already voted for this option');
        return;
      }

      // Check if single vote survey and user already voted
      if (!survey.allow_multiple_answers && survey.userVotes && survey.userVotes.length > 0) {
        toast.info('You can only vote once on this survey');
        return;
      }

      const { error } = await supabase
        .from('user_votes')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          option_id: optionId
        });

      if (error) throw error;

      // Update local state
      setSurveys(prev => prev.map(s => {
        if (s.id === surveyId) {
          return {
            ...s,
            options: s.options.map(o => 
              o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o
            ),
            userVotes: [...(s.userVotes || []), optionId]
          };
        }
        return s;
      }));

      toast.success('Vote recorded!');
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to record vote');
    }
  };

  const react = async (surveyId: string, reactionType: ReactionType) => {
    if (!user) {
      toast.error('Please sign in to react');
      return;
    }

    try {
      const survey = surveys.find(s => s.id === surveyId);
      if (!survey) return;

      if (survey.userReaction === reactionType) {
        // Remove reaction
        await supabase
          .from('reactions')
          .delete()
          .eq('user_id', user.id)
          .eq('survey_id', surveyId);

        setSurveys(prev => prev.map(s => {
          if (s.id === surveyId) {
            return {
              ...s,
              reactions: s.reactions.filter(r => r.user_id !== user.id),
              userReaction: null
            };
          }
          return s;
        }));
      } else {
        // Upsert reaction
        const { data, error } = await supabase
          .from('reactions')
          .upsert({
            user_id: user.id,
            survey_id: surveyId,
            reaction: reactionType
          }, { onConflict: 'user_id,survey_id' })
          .select()
          .single();

        if (error) throw error;

        setSurveys(prev => prev.map(s => {
          if (s.id === surveyId) {
            const existingReaction = s.reactions.find(r => r.user_id === user.id);
            const newReactions = existingReaction
              ? s.reactions.map(r => r.user_id === user.id ? data as Reaction : r)
              : [...s.reactions, data as Reaction];
            return {
              ...s,
              reactions: newReactions,
              userReaction: reactionType
            };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error('Error reacting:', error);
      toast.error('Failed to save reaction');
    }
  };

  const addComment = async (surveyId: string, content: string) => {
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          content
        })
        .select()
        .single();

      if (error) throw error;

      setSurveys(prev => prev.map(s => {
        if (s.id === surveyId) {
          return {
            ...s,
            comments: [...s.comments, data as Comment]
          };
        }
        return s;
      }));

      toast.success('Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  return {
    surveys,
    loading,
    fetchSurveys,
    vote,
    react,
    addComment
  };
}
