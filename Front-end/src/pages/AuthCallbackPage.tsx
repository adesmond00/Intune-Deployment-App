import React, { useEffect } from 'react'; // Removed useContext
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../context/TenantContext'; // Import useTenant instead

const AuthCallbackPage: React.FC = () => {
  const { checkStatus } = useTenant(); // Use the custom hook
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('AuthCallbackPage: Running checkStatus...');
      try {
        // Assuming checkStatus updates the context state internally
        await checkStatus();
        console.log('AuthCallbackPage: checkStatus completed. Navigating to /');
        // Redirect to the main application page after status check
        navigate('/');
      } catch (error) {
        console.error('AuthCallbackPage: Error during checkStatus:', error);
        // Handle error appropriately - maybe navigate to an error page or show message
        // For now, just log and navigate to root
        navigate('/'); // Or navigate('/error') if you have an error page
      }
    };

    handleCallback();
  }, [checkStatus, navigate]); // Include dependencies used inside useEffect

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg text-gray-700 dark:text-gray-300">
        Finalizing login, please wait...
      </p>
      {/* Optional: Add a spinner */}
    </div>
  );
};

export default AuthCallbackPage;
