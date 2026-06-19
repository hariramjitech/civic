import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CivicProvider, useCivic } from './context/CivicContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Feed from './pages/Feed';
import PostDetail from './pages/PostDetail';
import SubmitPost from './pages/SubmitPost';
import MapView from './pages/MapView';
import ChatRooms from './pages/ChatRooms';
import StrikeRooms from './pages/StrikeRooms';
import MyAccount from './pages/MyAccount';
import AdminDashboard from './pages/AdminDashboard';
import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/clerk-react';

function ProtectedRoute({ children }) {
  const { loadingProfile } = useCivic();

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500"></div>
          <p className="text-gray-400 text-sm animate-pulse font-sans">Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <CivicProvider>
        <Layout>
          <Routes>
            {/* Public Landing */}
            <Route path="/" element={<Landing />} />
            
            {/* Authenticated Feed & Incident Tracking */}
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/posts/:id" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
            <Route path="/submit" element={<ProtectedRoute><SubmitPost /></ProtectedRoute>} />
            
            {/* GIS heat mapping */}
            <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
            
            {/* Ephemeral Realtime Chatrooms */}
            <Route path="/chat" element={<ProtectedRoute><ChatRooms /></ProtectedRoute>} />
            
            {/* Mobilization Strike Rooms */}
            <Route path="/strikes" element={<ProtectedRoute><StrikeRooms /></ProtectedRoute>} />
            
            {/* Private citizen logging */}
            <Route path="/my-account" element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />
            
            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </CivicProvider>
    </Router>
  );
}
