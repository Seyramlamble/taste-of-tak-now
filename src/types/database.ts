export type ReactionType = 'like' | 'dislike' | 'laugh' | 'sad';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  country: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface Preference {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface UserPreference {
  id: string;
  user_id: string;
  preference_id: string;
}

export interface Survey {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  preference_id: string | null;
  target_country: string | null;
  allow_multiple_answers: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveyOption {
  id: string;
  survey_id: string;
  option_text: string;
  vote_count: number;
  created_at: string;
}

export interface UserVote {
  id: string;
  user_id: string;
  survey_id: string;
  option_id: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  user_id: string;
  survey_id: string;
  reaction: ReactionType;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  survey_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyWithDetails extends Survey {
  options: SurveyOption[];
  reactions: Reaction[];
  comments: Comment[];
  preference?: Preference;
  author?: Profile;
  userVotes?: string[];
  userReaction?: ReactionType | null;
}
