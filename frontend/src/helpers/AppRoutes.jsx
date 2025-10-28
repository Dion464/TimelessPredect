import React from 'react';
import { Route, Switch } from 'react-router-dom';
import Markets from '../pages/markets/Markets';
import About from '../pages/about/About';
import Stats from '../pages/stats/Stats';
import Home from '../pages/home/Home';
import PolymarketStyleTrading from '../pages/market/PolymarketStyleTrading';
import User from '../pages/user/User';
import MarketCreation from '../pages/admin/MarketCreation';
import AdminLogin from '../pages/admin/AdminLogin';
import RevenueDashboard from '../components/admin/RevenueDashboard';
import NotFound from '../pages/notfound/NotFound';
import Web3ErrorBoundary from '../components/fallback/Web3ErrorBoundary';

const AppRoutes = () => {
  return (
    <Switch>
      {/* Public Routes */}
      <Route exact path='/about' component={About} />
      
      <Route exact path='/markets/:marketId'>
        <Web3ErrorBoundary>
          <PolymarketStyleTrading />
        </Web3ErrorBoundary>
      </Route>
      
      <Route exact path='/markets' component={Markets} />
      
      <Route exact path='/user/:username' component={User} />
      
      <Route exact path='/stats' component={Stats} />

      {/* Admin Routes */}
      <Route exact path='/admin' component={AdminLogin} />
      <Route exact path='/admin/create-market' component={MarketCreation} />
      <Route exact path='/admin/revenue' component={RevenueDashboard} />

      {/* Home Route */}
      <Route exact path='/' component={Home} />

      {/* 404 Route */}
      <Route path='*' component={NotFound} />
    </Switch>
  );
};

export default AppRoutes;
