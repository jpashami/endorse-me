import React, { useState, useEffect } from 'react';
import { Award, Search, ThumbsUp, ExternalLink, AlertTriangle, LogOut } from 'lucide-react';
import { initTelegramApp, sendBotCommand, getCurrentUser, validateTelegramEnv, telegram, handleLogout } from './telegram';
import { config } from './config';
import { createEndorsement, getEndorsements } from './lib/supabase';

function LoginScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Telegram Login Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', config.telegramBot.username.replace('@', ''));
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

    // Add global callback function
    window.onTelegramAuth = (user: any) => {
      console.log('Telegram auth successful:', user);
      localStorage.setItem('telegram_user', JSON.stringify(user));
      window.location.reload(); // Reload to update the UI with the logged-in state
    };

    const container = document.getElementById('telegram-login');
    if (container) {
      container.appendChild(script);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
      delete window.onTelegramAuth;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <Award className="w-16 h-16 text-blue-600 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Endorse Me</h1>
        <p className="text-gray-600 mb-8">
          Sign in with your Telegram account to start endorsing and building trust in the community.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        <div id="telegram-login" className="flex justify-center mb-4"></div>
        <p className="mt-4 text-sm text-gray-500">
          You can also use our Telegram bot directly: {config.telegramBot.username}
        </p>
      </div>
    </div>
  );
}

function App() {
  const [telegramId, setTelegramId] = useState('');
  const [category, setCategory] = useState('Money exchange');
  const [note, setNote] = useState('');
  const [trustLevel, setTrustLevel] = useState('3'); // Default trust level
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    first_name: string;
    username?: string;
  } | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const [endorsements, setEndorsements] = useState<any[]>([]);

  const categories = [
    'Money exchange',
    'Goods exchange',
    'Services',
    'Professional skills',
    'Personal character',
    'Community contribution'
  ];

  const trustLevels = [
    { value: '1', label: 'Level 1 - Basic Trust' },
    { value: '2', label: 'Level 2 - Moderate Trust' },
    { value: '3', label: 'Level 3 - High Trust' },
    { value: '4', label: 'Level 4 - Complete Trust' }
  ];

  useEffect(() => {
    try {
      // Validate environment variables
      const { isValid, missingVars } = validateTelegramEnv();
      if (!isValid) {
        setEnvError(`Missing environment variables: ${missingVars.join(', ')}`);
        return;
      }

      // Get current user's information
      const user = getCurrentUser();
      if (user) {
        setCurrentUser(user);
        // Initialize Telegram WebApp
        initTelegramApp();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred during initialization');
    }
  }, []);

  const handleEndorse = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLoading(true);
      
      if (!telegramId.trim()) {
        throw new Error('Please enter a valid Telegram username');
      }

      if (!currentUser?.username) {
        throw new Error('You must be logged in with a username to endorse users');
      }

      // Format username if needed
      const username = telegramId.startsWith('@') ? telegramId : `@${telegramId}`;
      
      // Create endorsement in database with trust level
      await createEndorsement(
        username,
        category,
        note.trim() || null,
        currentUser.username,
        parseInt(trustLevel)
      );

      // Send the endorse command with category, note, and trust level
      await sendBotCommand('/endorse', username, category, `${note.trim() || ''} [Trust Level: ${trustLevel}]`);

      setSuccess(`Endorsement request sent for ${username} with Trust Level ${trustLevel}`);
      setTelegramId('');
      setNote('');
      setTrustLevel('3'); // Reset to default trust level
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEndorsements = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      if (!telegramId.trim()) {
        throw new Error('Please enter a valid Telegram username');
      }

      // Format username if needed
      const username = telegramId.startsWith('@') ? telegramId : `@${telegramId}`;
      
      // Get endorsements from database
      const endorsementData = await getEndorsements(username);
      setEndorsements(endorsementData);

      // Send the check command
      await sendBotCommand('/check', username);

      setSuccess(`Retrieved endorsements for ${username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setEndorsements([]);
    } finally {
      setLoading(false);
    }
  };

  if (envError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertTriangle className="w-6 h-6" />
            <h1 className="text-xl font-bold">Configuration Error</h1>
          </div>
          <p className="text-gray-700">{envError}</p>
          <p className="mt-4 text-sm text-gray-600">
            Please check your .env file and ensure all required variables are set.
          </p>
        </div>
      </div>
    );
  }

  // Show login screen if user is not authenticated
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-8 h-8 text-blue-600" />
              Endorse Me
            </h1>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Welcome, {currentUser.first_name}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Description Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About Endorse Me Bot</h2>
          <p className="text-gray-600 mb-4">
            Endorse Me is a decentralized social trust platform that allows you to build and verify your reputation through peer endorsements. Using our Telegram bot, you can easily endorse others and track trust scores across the community.
          </p>
          <a
            href="https://endorse-me.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            Learn more
            <ExternalLink className="w-4 h-4 ml-1" />
          </a>
        </div>

        {/* Actions Section */}
        <div className="space-y-6">
          {/* Input Fields */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div>
              <label htmlFor="telegramId" className="block text-sm font-medium text-gray-700 mb-2">
                Enter Telegram Username
              </label>
              <input
                type="text"
                id="telegramId"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., @username"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="trustLevel" className="block text-sm font-medium text-gray-700 mb-2">
                Trust Level
              </label>
              <select
                id="trustLevel"
                value={trustLevel}
                onChange={(e) => setTrustLevel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {trustLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
                Note (Optional)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a brief note about this endorsement..."
                rows={3}
              />
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleEndorse}
              disabled={loading || !telegramId}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-4 px-6 font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ThumbsUp className="w-5 h-5" />
              Endorse User
            </button>
            
            <button
              onClick={handleCheckEndorsements}
              disabled={loading || !telegramId}
              className="flex items-center justify-center gap-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg py-4 px-6 font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5" />
              Check Endorsements
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-6 text-center text-gray-600">
            Processing your request...
          </div>
        )}

        {/* Endorsements List */}
        {endorsements.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Endorsement History</h3>
            <div className="space-y-4">
              {endorsements.map((endorsement) => (
                <div key={endorsement.id} className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600">
                        Endorsed by: <span className="font-medium">{endorsement.endorsed_by}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Category: <span className="font-medium">{endorsement.categories.name}</span>
                      </p>
                      {endorsement.note && (
                        <p className="text-sm text-gray-700 mt-2">{endorsement.note}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(endorsement.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;