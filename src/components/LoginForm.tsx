import React, { useState } from 'react';
import { useAuthStore } from '../lib/store';
import { toast } from 'react-hot-toast';
import { LogIn, Shield, Lock, KeyRound, ExternalLink, AlertTriangle } from 'lucide-react';

export function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!identifier.trim() || !password.trim()) {
        throw new Error('Please fill in all fields');
      }

      await login(identifier.trim(), password);
      toast.success('Successfully logged in!');
    } catch (err) {
      const error = err as Error;
      const errorMessage = error.message || 'Login failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const securityFeatures = [
    {
      icon: Shield,
      title: 'Secure Authentication',
      description: "Direct authentication through Bluesky's official API"
    },
    {
      icon: Lock,
      title: 'No Password Storage',
      description: 'Your credentials are never stored or saved'
    },
    {
      icon: KeyRound,
      title: 'Session Security',
      description: 'Automatic session expiration after 24 hours'
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <LogIn className="w-12 h-12 text-indigo-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Sign in to Bluesky
        </h2>
        
        <p className="text-center text-gray-600 mb-8">
          Secure login via{' '}
          <a 
            href="https://bsky.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 inline-flex items-center"
          >
            Bluesky
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Handle or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center">
                <LogIn className="w-5 h-5 mr-2" />
                Sign in
              </span>
            )}
          </button>
        </form>

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Security Features</span>
            </div>
          </div>

          <div className="grid gap-4">
            {securityFeatures.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                <div className="flex-shrink-0">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{title}</h3>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}