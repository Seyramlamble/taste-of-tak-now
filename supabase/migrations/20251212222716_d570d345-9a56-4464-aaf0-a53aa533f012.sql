-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for reaction types
CREATE TYPE public.reaction_type AS ENUM ('like', 'dislike', 'laugh', 'sad');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  country TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create preferences table
CREATE TABLE public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT
);

-- Create user_preferences junction table
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  preference_id UUID REFERENCES public.preferences(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (user_id, preference_id)
);

-- Create surveys table
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  preference_id UUID REFERENCES public.preferences(id),
  target_country TEXT,
  allow_multiple_answers BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create survey_options table
CREATE TABLE public.survey_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_votes table
CREATE TABLE public.user_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.survey_options(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reactions table
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  reaction reaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, survey_id)
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Preferences policies (public read)
CREATE POLICY "Anyone can view preferences" ON public.preferences FOR SELECT USING (true);
CREATE POLICY "Admins can manage preferences" ON public.preferences FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User preferences policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- Surveys policies
CREATE POLICY "Users can view published surveys" ON public.surveys FOR SELECT USING (is_published = true);
CREATE POLICY "Users can create surveys" ON public.surveys FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own surveys" ON public.surveys FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Admins can manage all surveys" ON public.surveys FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Survey options policies
CREATE POLICY "Anyone can view options" ON public.survey_options FOR SELECT USING (true);
CREATE POLICY "Survey authors can manage options" ON public.survey_options FOR ALL USING (
  EXISTS (SELECT 1 FROM public.surveys WHERE id = survey_id AND author_id = auth.uid())
);
CREATE POLICY "Admins can manage options" ON public.survey_options FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User votes policies
CREATE POLICY "Users can view own votes" ON public.user_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can vote" ON public.user_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all votes" ON public.user_votes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Reactions policies
CREATE POLICY "Anyone can view reactions" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage own reactions" ON public.reactions FOR ALL USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage comments" ON public.comments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default preferences
INSERT INTO public.preferences (name, icon, color) VALUES
  ('Cooking', '🍳', '#FF6B35'),
  ('Sports', '⚽', '#4ECDC4'),
  ('Politics', '🏛️', '#45B7D1'),
  ('Relationships', '💕', '#F7DC6F'),
  ('Scandals', '🔥', '#E74C3C'),
  ('Music', '🎵', '#9B59B6'),
  ('Spirituality', '🙏', '#1ABC9C'),
  ('Science', '🔬', '#3498DB');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));
  
  -- Add default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to increment vote count
CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.survey_options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;
  RETURN NEW;
END;
$$;

-- Trigger to increment vote count
CREATE TRIGGER on_vote_created
  AFTER INSERT ON public.user_votes
  FOR EACH ROW EXECUTE FUNCTION public.increment_vote_count();

-- Enable realtime for surveys and comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.surveys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;