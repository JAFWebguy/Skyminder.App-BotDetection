import React from 'react';
import { useAuthStore } from './lib/store';
import { LoginForm } from './components/LoginForm';
import { ConnectionsList } from './components/ConnectionsList';
import { Footer } from './components/Footer';
import { Toaster } from 'react-hot-toast';
import { LogOut } from 'lucide-react';

function App() {
  const { isAuthenticated, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />
      
      {isAuthenticated ? (
        <>
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <h1 className="text-xl font-bold text-gray-900">Bluesky Follower Manager</h1>
                <button
                  onClick={logout}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </button>
              </div>
            </div>
          </nav>
          <main className="flex-1 py-8">
            <ConnectionsList />
          </main>
          <Footer />
        </>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}

export default App;