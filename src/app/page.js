import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

const Home = () => {
  return (
    <>
    <Navbar/>
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-700 to-indigo-900 text-white flex flex-col items-center justify-center p-8 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
      </div>

      <section className="max-w-6xl pt-10 text-center animate-hero-slide relative z-10">
        <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 animate-text-glow">
          Create Breathtaking PDF Designs
        </h1>
        <p className="text-xl sm:text-2xl max-w-3xl mx-auto leading-relaxed mb-10 animate-fade-in-up">
          Transform your ideas into stunning, professional PDFs with our cutting-edge editor.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/upload">
            <button className="px-10 py-5 bg-gradient-to-r from-purple-500 to-blue-500 font-semibold rounded-full shadow-2xl hover:shadow-[0_0_20px_rgba(59,130,246,0.7)] transition-all duration-500 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-400 flex items-center justify-center animate-pulse-button">
              Design Now
              <svg
                className="w-7 h-7 ml-3"
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
                />
              </svg>
            </button>
          </Link>
        </div>
      </section>

      <section className="mt-24 max-w-7xl w-full px-6 relative z-10">
        <h2 className="text-4xl sm:text-5xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-300 animate-text-glow">
          Elevate Your Design Experience
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 text-center transform hover:scale-105 hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all duration-500 animate-fade-in-up">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-white"
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
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Seamless Editor</h3>
            <p className="text-gray-200 leading-relaxed">
              Craft breathtaking PDFs with our intuitive drag-and-drop interface, designed for all skill levels.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 text-center transform hover:scale-105 hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all duration-500 animate-fade-in-up delay-100">
            <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Dynamic Data</h3>
            <p className="text-gray-200 leading-relaxed">
              Integrate Excel data effortlessly to create personalized, dynamic PDFs in seconds.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 text-center transform hover:scale-105 hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all duration-500 animate-fade-in-up delay-200">
            <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Bulk Exports</h3>
            <p className="text-gray-200 leading-relaxed">
              Generate and download multiple PDFs or PNGs with a single click, effortlessly.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-24 bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl shadow-2xl p-12 max-w-6xl w-full text-center animate-hero-slide relative z-10">
        <h2 className="text-4xl font-bold mb-6 animate-text-glow">Unleash Your Creativity Today</h2>
        <p className="text-lg mb-8 max-w-2xl mx-auto animate-fade-in-up">
          Start designing professional PDFs or dive into our curated template library to bring your vision to life.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/upload">
            <button className="px-10 py-5 bg-white text-purple-600 font-semibold rounded-full shadow-2xl hover:shadow-[0_0_20px_rgba(255,255,255,0.7)] transition-all duration-500 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white animate-pulse-button">
              Start Designing Now
            </button>
          </Link>
        </div>
      </section>
    </div>
    </>
  );
};

export default Home;