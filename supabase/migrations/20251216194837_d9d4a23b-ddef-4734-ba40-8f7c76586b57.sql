-- Create enum for group types
CREATE TYPE public.group_type AS ENUM ('family', 'company');

-- Create enum for group member roles
CREATE TYPE public.group_role AS ENUM ('owner', 'admin', 'member');

-- Create enum for invite status
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type group_type NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role group_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create survey_invites table for company customer invites
CREATE TABLE public.survey_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  email TEXT,
  invite_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days')
);

-- Add group_id to surveys table for group surveys
ALTER TABLE public.surveys 
ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
ADD COLUMN is_public_link BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_invites ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Users can view groups they belong to"
ON public.groups FOR SELECT
USING (
  owner_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid())
);

CREATE POLICY "Users can create groups"
ON public.groups FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Group owners can update their groups"
ON public.groups FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Group owners can delete their groups"
ON public.groups FOR DELETE
USING (auth.uid() = owner_id);

-- Group members policies
CREATE POLICY "Members can view group members"
ON public.group_members FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
);

CREATE POLICY "Group owners and admins can add members"
ON public.group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = group_id AND (
      g.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin'))
    )
  )
);

CREATE POLICY "Group owners and admins can remove members"
ON public.group_members FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = group_id AND (
      g.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin'))
    )
  )
);

-- Survey invites policies
CREATE POLICY "Survey authors can manage invites"
ON public.survey_invites FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.author_id = auth.uid())
);

CREATE POLICY "Anyone can view invite by token"
ON public.survey_invites FOR SELECT
USING (true);

-- Update surveys policy for group surveys
CREATE POLICY "Group members can view group surveys"
ON public.surveys FOR SELECT
USING (
  is_published = true OR
  auth.uid() = author_id OR
  (group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members gm WHERE gm.group_id = surveys.group_id AND gm.user_id = auth.uid()
  ))
);

-- Function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  ) OR EXISTS (
    SELECT 1
    FROM public.groups
    WHERE id = _group_id
      AND owner_id = _user_id
  )
$$;