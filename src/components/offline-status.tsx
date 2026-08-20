"use client";
import { useEffect, useState } from "react";
export function OfflineStatus(){const [offline,setOffline]=useState(false);useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)}},[]);return offline?<div role="status" className="fixed inset-x-0 top-0 z-50 bg-surface-2 px-4 py-2 text-center text-sm font-semibold">Offline — showing cached data</div>:null}
