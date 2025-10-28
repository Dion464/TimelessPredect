import React from 'react';
import { useParams } from 'react-router-dom';

const User = () => {
  const { username } = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            User Profile: {username}
          </h1>
          <p className="text-gray-600">
            User profile functionality coming soon. This will show portfolio and trading history from the blockchain.
          </p>
        </div>
      </div>
    </div>
  );
};

export default User;
