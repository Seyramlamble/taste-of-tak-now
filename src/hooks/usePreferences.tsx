import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Preference } from '@/types/database';
import { useAuth } from './useAuth';

export function usePreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserPreferences();
    } else {
      setUserPreferences([]);
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .order('name');

      if (error) throw error;
      setPreferences(data as Preference[]);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setUserPreferences(data.map((p) => p.preference_id));
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  const togglePreference = async (preferenceId: string) => {
    if (!user) return;

    const isSelected = userPreferences.includes(preferenceId);

    try {
      if (isSelected) {
        await supabase
          .from('user_preferences')
          .delete()
          .eq('user_id', user.id)
          .eq('preference_id', preferenceId);

        setUserPreferences(prev => prev.filter(id => id !== preferenceId));
      } else {
        await supabase
          .from('user_preferences')
          .insert({ user_id: user.id, preference_id: preferenceId });

        setUserPreferences(prev => [...prev, preferenceId]);
      }
    } catch (error) {
      console.error('Error toggling preference:', error);
    }
  };

  const savePreferences = async (selectedIds: string[]) => {
    if (!user) return;

    try {
      // Delete all existing preferences
      await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id);

      // Insert new preferences
      if (selectedIds.length > 0) {
        const inserts = selectedIds.map(preferenceId => ({
          user_id: user.id,
          preference_id: preferenceId
        }));

        await supabase.from('user_preferences').insert(inserts);
      }

      setUserPreferences(selectedIds);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  return {
    preferences,
    userPreferences,
    loading,
    togglePreference,
    savePreferences,
    refreshUserPreferences: fetchUserPreferences
  };
}
