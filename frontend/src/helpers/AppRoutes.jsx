import React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import Markets from '../pages/markets/Markets';
import About from '../pages/about/About';
import Stats from '../pages/stats/Stats';
import HomeWormStyle from '../pages/home/HomeWormStyle';
import Activity from '../pages/activity/Activity';
import PolymarketStyleTrading from '../pages/market/PolymarketStyleTrading';
import User from '../pages/user/User';
import CreateMarket from '../pages/create/CreateMarket';
import MarketCreation from '../pages/admin/MarketCreation';
import PendingMarkets from '../pages/admin/PendingMarkets';
import AdminResolution from '../pages/admin/AdminResolution';
import AdminLogin from '../pages/admin/AdminLogin';
import RevenueDashboard from '../components/admin/RevenueDashboard';
import NotFound from '../pages/notfound/NotFound';
import { useWeb3 } from '../hooks/useWeb3';

// Admin addresses (lowercase)
const ADMIN_ADDRESSES = [
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat account #0
  '0xed27c34a8434adc188a2d7503152024f64967b61', // User's admin wallet
  // Add more admin addresses here
].map(addr => addr.toLowerCase());

// Protected Admin Route Component
const AdminRoute = ({ component: Component, ...rest }) => {
  const { account, isConnected } = useWeb3();
  // Check both wallet-based AND localStorage-based admin
  const isWalletAdmin = isConnected && account && ADMIN_ADDRESSES.includes(account.toLowerCase());
  const isLocalStorageAdmin = localStorage.getItem('isAdminLoggedIn') === 'true' && localStorage.getItem('usertype') === 'admin';
  const isAdmin = isWalletAdmin || isLocalStorageAdmin;

  return (
    <Route
      {...rest}
      render={(props) =>
        isAdmin ? (
          <Component {...props} />
        ) : (
          <Redirect to='/admin' />
        )
      }
    />
  );
};

const AppRoutes = () => {
  return (
    <Switch>
      {/* Public Routes */}
      <Route exact path='/about' component={About} />
      
      <Route exact path='/markets/:marketId'>
        <PolymarketStyleTrading />
      </Route>
      
      <Route exact path='/market/:marketId'>
        <PolymarketStyleTrading />
      </Route>
      
      <Route exact path='/markets' component={Markets} />
      
      <Route exact path='/user/:address' component={User} />
      
      <Route exact path='/stats' component={Stats} />
      <Route exact path='/activity' component={Activity} />

      {/* Public Market Creation */}
      <Route exact path='/create' component={CreateMarket} />

      {/* Admin Routes - Protected */}
      <Route exact path='/admin' component={AdminLogin} />
      <AdminRoute exact path='/admin/create-market' component={MarketCreation} />
      <AdminRoute exact path='/admin/pending' component={PendingMarkets} />
      <AdminRoute exact path='/admin/resolve' component={AdminResolution} />
      <AdminRoute exact path='/admin/revenue' component={RevenueDashboard} />

      {/* Home Route */}
      <Route exact path='/' component={HomeWormStyle} />

      {/* 404 Route */}
      <Route path='*' component={NotFound} />
    </Switch>
  );
};

export default AppRoutes;
