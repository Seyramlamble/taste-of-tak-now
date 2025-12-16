import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Users, 
  Building2, 
  Home, 
  Plus, 
  Loader2, 
  ArrowLeft,
  UserPlus,
  Trash2,
  Mail,
  Crown,
  Shield
} from 'lucide-react';
import type { Group, GroupMember, Profile, GroupType, GroupRole } from '@/types/database';

interface GroupWithDetails extends Group {
  members: (GroupMember & { profile?: Profile })[];
  survey_count?: number;
}

export default function Groups() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithDetails | null>(null);
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    type: 'family' as GroupType
  });
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      // Fetch groups where user is owner or member
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*');

      if (groupsError) throw groupsError;

      // Fetch members for each group
      const groupsWithDetails = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { data: members } = await supabase
            .from('group_members')
            .select('*')
            .eq('group_id', group.id);

          // Fetch profiles for members
          const memberIds = members?.map(m => m.user_id) || [];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', memberIds);

          const membersWithProfiles = members?.map(member => ({
            ...member,
            profile: profiles?.find(p => p.id === member.user_id)
          })) || [];

          // Count surveys
          const { count } = await supabase
            .from('surveys')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          return {
            ...group,
            members: membersWithProfiles,
            survey_count: count || 0
          } as GroupWithDetails;
        })
      );

      setGroups(groupsWithDetails);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setIsCreating(true);
    try {
      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          name: newGroup.name,
          description: newGroup.description || null,
          type: newGroup.type,
          owner_id: user!.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as a member
      await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user!.id,
          role: 'owner'
        });

      toast.success('Group created successfully!');
      setCreateDialogOpen(false);
      setNewGroup({ name: '', description: '', type: 'family' });
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !selectedGroup) {
      toast.error('Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.toLowerCase())
        .single();

      if (profileError || !profile) {
        toast.error('User not found. They must have an account first.');
        setIsInviting(false);
        return;
      }

      // Check if already a member
      const existingMember = selectedGroup.members.find(m => m.user_id === profile.id);
      if (existingMember) {
        toast.error('User is already a member');
        setIsInviting(false);
        return;
      }

      // Add member
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: selectedGroup.id,
          user_id: profile.id,
          role: 'member'
        });

      if (error) throw error;

      toast.success('Member added successfully!');
      setInviteDialogOpen(false);
      setInviteEmail('');
      fetchGroups();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Failed to add member');
    } finally {
      setIsInviting(false);
    }
  };

  const removeMember = async (groupId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Member removed');
      fetchGroups();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group deleted');
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  const getRoleIcon = (role: GroupRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl">My Groups</h1>
                <p className="text-sm text-muted-foreground">Family & Company groups</p>
              </div>
            </div>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Group Type</Label>
                  <Select 
                    value={newGroup.type} 
                    onValueChange={(v: GroupType) => setNewGroup(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="family">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4" />
                          Family Group
                        </div>
                      </SelectItem>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Company Group
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Group Name *</Label>
                  <Input
                    placeholder={newGroup.type === 'family' ? "My Family" : "Acme Corp"}
                    value={newGroup.name}
                    onChange={e => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="What's this group for?"
                    value={newGroup.description}
                    onChange={e => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <Button onClick={createGroup} disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Create Group'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 lg:p-8">
        {groups.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No groups yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a family or company group to share private surveys
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map(group => (
              <Card key={group.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        group.type === 'family' 
                          ? 'bg-pink-100 text-pink-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {group.type === 'family' ? (
                          <Home className="w-5 h-5" />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {group.type} · {group.members.length} members · {group.survey_count} surveys
                        </CardDescription>
                      </div>
                    </div>
                    {group.owner_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteGroup(group.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {group.description && (
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Members</Label>
                      {(group.owner_id === user?.id || 
                        group.members.find(m => m.user_id === user?.id && m.role === 'admin')) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedGroup(group);
                            setInviteDialogOpen(true);
                          }}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {group.members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(member.role)}
                            <span className="text-sm">
                              {member.profile?.display_name || member.profile?.email || 'Unknown'}
                            </span>
                          </div>
                          {group.owner_id === user?.id && member.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => removeMember(group.id, member.user_id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate(`/groups/${group.id}/surveys`)}
                  >
                    View Group Surveys
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to {selectedGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Email Address</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                The user must have an existing account
              </p>
            </div>
            <Button onClick={inviteMember} disabled={isInviting} className="w-full">
              {isInviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
