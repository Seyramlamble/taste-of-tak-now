import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageSquare, ArrowRight, Users, BarChart3, Sparkles } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-10" />
        <nav className="relative z-10 max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">PulseVote</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/auth?mode=login')} variant="outline">
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth')} variant="default">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 lg:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Community-Driven Polls</span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-bold mb-6 leading-tight">
            Your Voice,{' '}
            <br className="sm:hidden" />
            <span className="text-primary">
              Your Community
            </span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join PulseVote to participate in surveys that matter to you. Share opinions,
            discover trends, and connect with like-minded people across topics you care about.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')} className="text-lg px-8">
              Join Now — It's Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl lg:text-4xl font-bold mb-4">
            Why PulseVote?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A new way to engage with your community through quick, meaningful polls
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 rounded-2xl bg-card border transition-all hover:shadow-lg">
            <div className="w-14 h-14 rounded-xl bg-category-cooking/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-category-cooking" />
            </div>
            <h3 className="font-display font-semibold text-xl mb-2">Personalized Feed</h3>
            <p className="text-muted-foreground">
              Choose your interests and get surveys tailored just for you. From politics to pop culture.
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-card border transition-all hover:shadow-lg">
            <div className="w-14 h-14 rounded-xl bg-category-politics/20 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-7 h-7 text-category-politics" />
            </div>
            <h3 className="font-display font-semibold text-xl mb-2">Real-Time Results</h3>
            <p className="text-muted-foreground">
              See how others voted instantly. Watch trends emerge as your community weighs in.
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-card border transition-all hover:shadow-lg">
            <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-7 h-7 text-accent" />
            </div>
            <h3 className="font-display font-semibold text-xl mb-2">React & Discuss</h3>
            <p className="text-muted-foreground">
              Express yourself with reactions and comments. Start conversations around the topics that matter.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-card border-y">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Ready to Make Your Voice Heard?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of people sharing their opinions every day.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}>
            Create Free Account
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">PulseVote</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 PulseVote. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
