import React, { useState, useEffect } from 'react';
import { useCivic } from '../context/CivicContext';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import { 
  User, MapPin, Heart, MessageSquare, Megaphone, 
  Settings, Loader2, Calendar, ShieldAlert, CheckCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyAccount() {
  const { userProfile, role, updateDistrict, isSignedIn } = useCivic();
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  
  // Data lists
  const [myPosts, setMyPosts] = useState([]);
  const [myComments, setMyComments] = useState([]);
  const [myLikes, setMyLikes] = useState([]);

  // District selector
  const [selectedDistrict, setSelectedDistrict] = useState('');

  const districts = [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
    'Tirunelveli', 'Vellore', 'Thoothukudi', 'Erode', 'Thanjavur', 
    'Dindigul', 'Ranipet', 'Tirupathur', 'Tenkasi', 'Chengalpattu', 
    'Kanchipuram', 'Tiruvallur', 'Tiruppur', 'Karur', 'Namakkal', 
    'Nilgiris', 'Cuddalore', 'Villupuram', 'Krishnagiri', 'Dharmapuri'
  ];

  const fetchPrivateHistory = async () => {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      const [postRes, commentRes, likeRes] = await Promise.all([
        api.get('/auth/my-posts'),
        api.get('/auth/my-comments'),
        api.get('/auth/my-likes')
      ]);

      setMyPosts(postRes.data.posts || []);
      setMyComments(commentRes.data.comments || []);
      setMyLikes(likeRes.data.posts || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to sync history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      fetchPrivateHistory();
      if (userProfile?.district) {
        setSelectedDistrict(userProfile.district);
      }
    }
  }, [isSignedIn, userProfile]);

  const handleDistrictSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDistrict) return;
    const success = await updateDistrict(selectedDistrict);
    if (success) {
      fetchPrivateHistory();
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        <p className="text-gray-400 font-display">Decrypting private ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Info Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-teal-500/10 border-2 border-teal-500/20 flex items-center justify-center text-teal-400">
            <User size={32} />
          </div>
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-gray-200">
              {userProfile?.displayName || 'Citizen Member'}
            </h2>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
              <span className="bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20 uppercase font-extrabold">
                {role} account
              </span>
              {userProfile?.district && (
                <span className="flex items-center space-x-1 text-gray-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
                  <MapPin size={10} />
                  <span>{userProfile.district}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* District Form */}
        <form onSubmit={handleDistrictSubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-xs rounded-lg p-2.5 text-gray-300 focus:outline-none focus:border-teal-500 w-full md:w-48"
          >
            <option value="">Set Home District</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button
            type="submit"
            className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-gray-900 font-bold text-xs rounded-lg flex-shrink-0"
          >
            Update
          </button>
        </form>
      </div>

      {/* Account statistics logs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl text-center">
          <div className="text-2xl font-extrabold text-teal-400 font-display">{myPosts.length}</div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">My Reports</div>
        </div>
        <div className="glass-panel p-4 rounded-xl text-center">
          <div className="text-2xl font-extrabold text-teal-400 font-display">{myComments.length}</div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">Comments Written</div>
        </div>
        <div className="glass-panel p-4 rounded-xl text-center">
          <div className="text-2xl font-extrabold text-teal-400 font-display">{myLikes.length}</div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">Interactions</div>
        </div>
      </div>

      {/* Warning text clarifying privacy parameters */}
      <div className="p-3 bg-rose-950/10 border border-rose-900/10 rounded-xl text-xs flex items-start space-x-2 text-rose-300">
        <ShieldAlert size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Privacy Parameter Clarification:</strong> While you can view your personal filing ledger here, your identity remains completely masked in all public records, map points, and feeds. Even database administrators cannot link these reports to your real name.
        </p>
      </div>

      {/* History Tabs */}
      <div className="space-y-4">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-900">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'posts'
                ? 'border-teal-500 text-teal-400 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            My Reports ({myPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'comments'
                ? 'border-teal-500 text-teal-400 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            My Comments ({myComments.length})
          </button>
          <button
            onClick={() => setActiveTab('likes')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'likes'
                ? 'border-teal-500 text-teal-400 font-extrabold'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Liked & Saved ({myLikes.length})
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="pt-2">
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {myPosts.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-6">You have not submitted any civic reports yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myPosts.map((post) => (
                    <div key={post._id} className="glass-panel p-4 rounded-xl border border-gray-900 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span className="capitalize">{post.category}</span>
                          <span className="uppercase font-bold text-teal-400">{post.status}</span>
                        </div>
                        <Link to={`/posts/${post._id}`} className="font-bold text-gray-200 hover:text-teal-400 block text-sm mt-1.5 transition-colors">
                          {post.title}
                        </Link>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{post.description}</p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-gray-900/60">
                        <span className="flex items-center space-x-1">
                          <Calendar size={10} />
                          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        </span>
                        <span>{post.intensityScore} 🔥 Intensity</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-3">
              {myComments.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-6">You have not commented on any issues yet.</p>
              ) : (
                myComments.map((comment) => (
                  <div key={comment._id} className="p-4 rounded-xl bg-gray-900/30 border border-gray-900 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>
                        On Post:{' '}
                        {comment.postId ? (
                          <Link to={`/posts/${comment.postId._id}`} className="text-teal-400 hover:underline">
                            {comment.postId.title}
                          </Link>
                        ) : (
                          <span className="italic">Deleted Incident</span>
                        )}
                      </span>
                      <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-300 text-xs font-sans">"{comment.text}"</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'likes' && (
            <div className="space-y-4">
              {myLikes.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-6">You have not bookmarked/liked any reports yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myLikes.map((post) => (
                    <div key={post._id} className="glass-panel p-4 rounded-xl border border-gray-900 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span className="capitalize">{post.category}</span>
                          <span className="uppercase font-bold text-teal-400">{post.status}</span>
                        </div>
                        <Link to={`/posts/${post._id}`} className="font-bold text-gray-200 hover:text-teal-400 block text-sm mt-1.5 transition-colors">
                          {post.title}
                        </Link>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{post.description}</p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-gray-900/60">
                        <span className="flex items-center space-x-1">
                          <Calendar size={10} />
                          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        </span>
                        <span>{post.intensityScore} 🔥 Intensity</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
