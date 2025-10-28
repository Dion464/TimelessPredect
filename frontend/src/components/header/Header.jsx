import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../logo/Logo';

const Header = () => {
    return (
        <nav className="flex items-center justify-between flex-wrap bg-gray-800 p-6">
            <div className="flex items-center flex-shrink-0 mr-6">
                <Logo />
            </div>
            <div className="w-full block flex-grow lg:flex lg:items-center lg:w-auto">
                <div className="space-y-2 lg:flex-grow lg:space-x-4 text-white font-medium">
                    <Link to="/" className="block lg:inline-block hover:text-blue-400 px-3 py-2">Home</Link>
                    <Link to="/markets" className="block lg:inline-block hover:text-blue-400 px-3 py-2">Markets</Link>
                    <Link to="/about" className="block lg:inline-block hover:text-blue-400 px-3 py-2">About</Link>
                    <Link to="/stats" className="block lg:inline-block hover:text-blue-400 px-3 py-2">Stats</Link>
                </div>
            </div>
        </nav>
    );
};

export default Header;
