import { useState, useEffect, useRef } from 'react'
import './App.css'
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './supabaseClient';

interface GratitudePost {
  id: string;
  message: string;
  created_at: string;
  color?: string;
  rotation?: number;
}

const NOTE_COLORS = [
  '#fff9b1', // yellow
  '#b1eaff', // blue
  '#ffd6e0', // pink
  '#d4ffb1', // green
  '#ffe4b1', // orange
  '#e0d6ff', // purple
];

function getRandomColor() {
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function App() {
  const [posts, setPosts] = useState<GratitudePost[]>([]);
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const highlightTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch notes from Supabase on mount
  useEffect(() => {
    const fetchNotes = async () => {
      const { data, error } = await supabase
        .from('gratitude_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setPosts(data.map((note: any) => ({
          ...note,
          color: note.color || getRandomColor(),
        })));
      }
    };
    fetchNotes();

    // Real-time subscription
    const channel = supabase
      .channel('gratitude-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gratitude_notes' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setPosts(prev => [
              { ...payload.new, color: payload.new.color || getRandomColor() },
              ...prev.filter(p => p.id !== payload.new.id)
            ]);
            setJustAddedId(payload.new.id);
            if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
            highlightTimeout.current = setTimeout(() => setJustAddedId(null), 1200);
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
    };
  }, []);

  // Add note to Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    const newNote = {
      message: message.trim(),
      color: getRandomColor(),
    };
    const { data, error } = await supabase
      .from('gratitude_notes')
      .insert([newNote])
      .select();
    if (!error && data && data[0]) {
      setPosts([data[0], ...posts]);
      setMessage('');
    }
  };

  // Delete note from Supabase
  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('gratitude_notes')
      .delete()
      .eq('id', id);
    if (!error) {
      setPosts(posts.filter(post => post.id !== id));
    }
  };

  const handleShare = async (id: string, message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (e) {
      alert('Failed to copy!');
    }
  };

  return (
    <div className="wall-container bulletin-bg">
      <div className="header-area">
        <h1 className="wall-title">Mana's Wall of Love 💖</h1>
        <form className="gratitude-form" onSubmit={handleSubmit}>
          <textarea
            className="gratitude-input"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="What's one thing you're grateful for on your Mana Journey?"
            rows={3}
            maxLength={240}
          />
          <button className="gratitude-submit" type="submit">Post</button>
        </form>
      </div>
      <div className="gratitude-wall bulletin-board">
        {posts.length === 0 ? (
          <p className="empty-wall">No posts yet. Be the first to share some love!</p>
        ) : (
          <AnimatePresence>
            {posts.map((post) => (
              <motion.div
                className={`gratitude-post bulletin-note${justAddedId === post.id ? ' note-highlight' : ''}`}
                key={post.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 60 }}
                transition={{ duration: 0.6, type: 'tween', ease: 'easeInOut' }}
                style={{
                  background: post.color,
                }}
              >
                <p className="gratitude-message">{post.message}</p>
                <span className="gratitude-date">{formatDate(post.created_at)}</span>
                <button className="note-delete" title="Delete" onClick={() => handleDelete(post.id)}>🗑️</button>
                <button className="note-share" title="Share" onClick={() => handleShare(post.id, post.message)}>
                  {copiedId === post.id ? 'Copied!' : '🔗'}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default App
