import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
       <Link to="/">
        <h1 className="text-xl font-bold text-black flex items-center gap-2">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="font-light">ONE</span>SHOOT
        </h1>
       </Link>
        <nav className="hidden md:flex space-x-6">
          <Link
            to="/"
            className="text-sm font-medium text-gray-700 hover:text-black"
          >
            Gallery
          </Link>
          
          <a
            href="#"
            className="text-sm font-medium text-gray-700 hover:text-black"
          >
            About
          </a>
        </nav>
        <button className="text-sm font-medium bg-black text-white px-4 py-2 rounded hover:bg-gray-900 transition">
          Contact
        </button>
      </div>
    </header>
  );
};

export default Navbar;
