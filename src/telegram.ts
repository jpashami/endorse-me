import { config } from './config';
import { logActivity } from './lib/supabase';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready(): void;
        close(): void;
        expand(): void;
        MainButton: {
          text: string;
          show(): void;
          hide(): void;
          onClick(callback: () => void): void;
        };
        sendData(data: string): void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string;
        };
        onEvent(eventType: string, callback: () => void): void;
        openTelegramLink(url: string): void;
      };
    };
  }
}

export const telegram = window.Telegram?.WebApp;

export const initTelegramApp = async () => {
  try {
    console.log('Initializing Telegram WebApp...');
    
    if (!telegram) {
      console.error('Telegram WebApp not available');
      throw new Error('Telegram WebApp is not available. Please open this app through Telegram.');
    }

    if (!config.telegramBot.username) {
      console.error('Missing bot configuration:', { 
        hasUsername: !!config.telegramBot.username 
      });
      throw new Error('Telegram bot configuration is missing. Please check your .env file.');
    }

    console.log('WebApp configuration valid, initializing...');
    telegram.ready();
    telegram.expand();

    telegram.onEvent('viewportChanged', () => {
      console.log('Viewport changed event triggered');
    });

    console.log('WebApp initialized successfully');
    await logActivity(
      'SYSTEM',
      'INIT_WEBAPP',
      {
        bot_username: config.telegramBot.username
      },
      'SUCCESS',
      telegram.initDataUnsafe.user?.id
    );
  } catch (error) {
    console.error('WebApp initialization failed:', error);
    await logActivity(
      'ERROR',
      'INIT_WEBAPP',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        bot_username: config.telegramBot.username
      },
      'ERROR',
      telegram.initDataUnsafe.user?.id
    );
    throw error;
  }
};

export const sendBotCommand = async (command: string, username: string, category?: string, note?: string) => {
  try {
    console.log('Sending bot command:', { command, username, category, note });
    
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User must be logged in to perform this action');
    }

    // Remove @ from username if present and add it back to ensure consistent format
    const cleanUsername = username.replace('@', '');
    const formattedUsername = `@${cleanUsername}`;
    
    // Construct the command message
    let message = `${command} ${formattedUsername}`;
    //if (command === '/endorse' && category) {
    //  message += ` [${category}]`;
    //  if (note) {
    //    message += ` - ${note}`;
    //  }
   // }

    // Use the Telegram Bot API directly
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBot.token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: user.id, // Use the current user's ID as chat_id
        text: message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API error: ${error.description}`);
    }

    const result = await response.json();
    console.log('Command sent successfully:', result);

    await logActivity(
      'API_CALL',
      'SEND_COMMAND',
      {
        command,
        username: formattedUsername,
        category,
        note,
        sender: user.username || user.id.toString(),
        response: result
      },
      'SUCCESS',
      user.id
    );
  } catch (error) {
    console.error('Failed to send bot command:', error);
    await logActivity(
      'ERROR',
      'SEND_COMMAND',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        command,
        username,
        category,
        note
      },
      'ERROR',
      telegram?.initDataUnsafe.user?.id
    );
    throw error;
  }
};

export const getCurrentUser = () => {
  console.log('Getting current user...');
  
  // First check localStorage for web login
  const storedUser = localStorage.getItem('telegram_user');
  if (storedUser) {
    console.log('Found user in localStorage');
    return JSON.parse(storedUser);
  }
  
  // If not in localStorage, check Telegram WebApp
  if (!telegram) {
    console.log('Telegram WebApp not available for getting user');
    return null;
  }

  const user = telegram.initDataUnsafe.user || null;
  console.log('Current user:', user);

  if (user) {
    logActivity(
      'AUTH',
      'GET_CURRENT_USER',
      {
        user_id: user.id,
        username: user.username
      },
      'SUCCESS',
      user.id
    );
  }

  return user;
};

export const validateTelegramEnv = () => {
  console.log('Validating Telegram environment...');
  
  const missingVars = [];
  if (!config.telegramBot.token) missingVars.push('VITE_TELEGRAM_BOT_TOKEN');
  if (!config.telegramBot.username) missingVars.push('VITE_TELEGRAM_BOT_USERNAME');
  if (!config.telegramBot.webAppUrl) missingVars.push('VITE_TELEGRAM_WEBAPP_URL');
  
  const isValid = missingVars.length === 0;
  console.log('Environment validation result:', { isValid, missingVars });
  
  return {
    isValid,
    missingVars,
  };
};

export const handleLogout = async () => {
  console.log('Logging out user...');
  
  try {
    // Clear localStorage
    localStorage.removeItem('telegram_user');
    
    // Log the activity
    const user = getCurrentUser();
    if (user) {
      await logActivity(
        'AUTH',
        'LOGOUT',
        {
          user_id: user.id,
          username: user.username
        },
        'SUCCESS',
        user.id
      );
    }
    
    // Reload the page to reset the application state
    window.location.reload();
    
    console.log('Logout successful');
  } catch (error) {
    console.error('Logout failed:', error);
    await logActivity(
      'ERROR',
      'LOGOUT',
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      'ERROR'
    );
    throw error;
  }
};
