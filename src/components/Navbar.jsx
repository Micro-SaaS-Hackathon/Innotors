import React from "react";
import Link from "next/link"; 

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <svg
                  className="w-8 h-8 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  ></path>
                </svg>
                <span className="text-xl font-bold text-gray-800">Temply</span>
              </div>
            </Link>
          </div>


          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="px-4 py-2 border border-indigo-600 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition-colors">
                Login
              </button>
            </Link>
            <Link href="/register">
              <button className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-medium rounded-lg shadow hover:from-indigo-600 hover:to-blue-700 transition-all">
                Sign Up
              </button>
            </Link>
          </div>

          <div className="md:hidden flex items-center">
            <button
              className="text-gray-700 hover:text-indigo-600 focus:outline-none focus:text-indigo-600"
              aria-label="Toggle Menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16m-7 6h7"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;