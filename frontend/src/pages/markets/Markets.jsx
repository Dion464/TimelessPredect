import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

function Markets() {
  const history = useHistory();
  
  useEffect(() => {
    // Redirect to home page
    history.replace('/');
  }, [history]);

  return null;
}

export default Markets;
