"use client"
import Navbar from "@/components/Navbar"
import dynamic from 'next/dynamic';

const Canva = dynamic(() => import('@/components/Canva'), {
  ssr: false, 
});

export default function App(){
    return (
        <>
        <Navbar/>
        <Canva/>
        </>
    )
}