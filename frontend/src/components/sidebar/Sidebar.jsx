import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AboutSVG,
  HomeSVG,
  MarketsSVG,
  MenuGrowSVG,
  MenuShrinkSVG,
  StatsSVG,
} from '../../assets/components/SvgIcons';

const SidebarLink = ({ to, icon: Icon, children }) => (
  <li>
    <Link
      to={to}
      className='flex items-center p-2 text-gray-300 rounded-lg hover:bg-gray-700 group transition-colors duration-200'
    >
      <Icon className='w-5 h-5 text-gray-400 group-hover:text-white transition-colors duration-200' />
      <span className='ml-3 text-sm'>{children}</span>
    </Link>
  </li>
);

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        !document.getElementById('sidebar')?.contains(event.target) &&
        isSidebarOpen
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSidebarOpen]);

  const renderLinks = () => {
    return (
      <>
        <SidebarLink to='/' icon={HomeSVG}>
          Home
        </SidebarLink>
        <SidebarLink to='/markets' icon={MarketsSVG}>
          Markets
        </SidebarLink>
        <SidebarLink to='/about' icon={AboutSVG}>
          About
        </SidebarLink>
        <SidebarLink to='/stats' icon={StatsSVG}>
          Stats
        </SidebarLink>
      </>
    );
  };

  return (
    <>
      <aside
        id='sidebar'
        className={`fixed top-0 left-0 z-30 w-48 h-screen bg-gray-800 text-white flex flex-col transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0`}
      >
        <div className='flex items-center justify-between p-3 border-b border-gray-700'>
          <h2 className='text-lg font-bold'>MetaPoly</h2>
          <button onClick={toggleSidebar} className='md:hidden'>
            {isSidebarOpen ? (
              <MenuShrinkSVG className='w-5 h-5' />
            ) : (
              <MenuGrowSVG className='w-5 h-5' />
            )}
          </button>
        </div>
        <nav className='flex-grow overflow-y-auto px-2 py-3'>
          <ul className='space-y-1'>{renderLinks()}</ul>
        </nav>
        <footer className='border-t border-gray-700 p-2'>
          <p className='text-xs text-center'>📈 Built with MetaPoly</p>
          <p className='text-xs text-center'>
            <a
              href='https://github.com/openpredictionmarkets/socialpredict'
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-400 hover:text-blue-300'
            >
              ⭐ Star Us on Github!
            </a>
          </p>
        </footer>
      </aside>
      {!isSidebarOpen && (
        <div className='fixed bottom-0 left-0 right-0 z-50 bg-gray-800 text-white flex justify-around items-center p-2 md:hidden'>
          <Link to='/' className='text-gray-300 hover:text-white'>
            <HomeSVG className='w-5 h-5' />
          </Link>
          <Link to='/markets' className='text-gray-300 hover:text-white'>
            <MarketsSVG className='w-5 h-5' />
          </Link>
          <button
            onClick={toggleSidebar}
            className='text-gray-300 hover:text-white'
          >
            <MenuGrowSVG className='w-5 h-5' />
          </button>
        </div>
      )}
    </>
  );
};

export default Sidebar;
