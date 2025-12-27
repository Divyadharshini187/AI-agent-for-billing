import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { OrderItem, LogMessage } from './types';
import { MENU_ITEMS } from './constants';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [transcript, setTranscript] = useState<LogMessage[]>([]);
  const [showBill, setShowBill] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Helper to accumulate streaming text
  const handleTranscriptUpdate = useCallback((text: string, isUser: boolean) => {
    setTranscript(prev => {
        const lastMsg = prev[prev.length - 1];
        const role = isUser ? 'user' : 'model';
        
        // If the last message is from the same role, append to it (grouping streaming chunks)
        if (lastMsg && lastMsg.role === role) {
            const updated = [...prev];
            updated[prev.length - 1] = {
                ...lastMsg,
                text: lastMsg.text + text
            };
            return updated;
        }
        return [...prev, { role, text, timestamp: new Date() }];
    });
  }, []);

  const handleOrderUpdate = useCallback((items: OrderItem[]) => {
    setCart(prev => [...prev, ...items]);
  }, []);

  const { status, connect, disconnect, isTalking } = useLiveSession({
    onOrderUpdate: handleOrderUpdate,
    onTranscriptUpdate: handleTranscriptUpdate
  });

  const toggleConnection = () => {
    if (status === 'connected' || status === 'connecting') {
      disconnect();
    } else {
      connect();
    }
  };

  useEffect(() => {
    // Scroll the container to the bottom only, without moving the whole page
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmOrder = () => {
    setShowBill(true);
    disconnect(); // Optional: stop session when order is done
  };

  const closeBill = () => {
    setShowBill(false);
    setCart([]);
    setTranscript([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-gray-100 overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]"></div>

      {/* Header */}
      <header className="relative z-10 px-8 py-6 flex justify-between items-center backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-orange-500 to-red-600 p-2.5 rounded-xl shadow-lg shadow-orange-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-200">Chennai Spice</h1>
            <p className="text-xs text-slate-400 tracking-wider uppercase">Premium Food Court</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {status === 'connected' && (
             <span className="flex items-center gap-2 text-sm text-green-400 bg-green-900/30 px-3 py-1.5 rounded-full border border-green-500/30">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               Live Session
             </span>
           )}
        </div>
      </header>

      <main className="flex-1 relative z-10 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Reception & Controls (6 Columns) */}
        <div className="lg:col-span-6 flex flex-col gap-6 h-[calc(100vh-140px)]">
          
          {/* Main Agent Card (Mic + Quick Menu) */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row gap-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-purple-500/5 group-hover:from-orange-500/10 group-hover:to-purple-500/10 transition-all duration-500"></div>
            
            {/* Left Side: Mic & Status */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
              <div className="mb-6 relative">
                 {status === 'connected' && (
                   <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse"></div>
                 )}
                 <button
                  onClick={toggleConnection}
                  disabled={status === 'connecting'}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 ${
                    status === 'connected' 
                      ? 'bg-red-500/10 border-2 border-red-500/50 text-red-500' 
                      : 'bg-gradient-to-br from-orange-500 to-red-600 text-white hover:shadow-orange-500/50'
                  }`}
                >
                  {status === 'connecting' ? (
                     <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : status === 'connected' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="h-12 flex items-center justify-center w-full mb-2">
                 <Visualizer isActive={status === 'connected'} isTalking={isTalking} />
              </div>

              {/* Status Text Indicator */}
              <div className="h-6 flex items-center justify-center">
                {status === 'connected' ? (
                  isTalking ? (
                    <p className="text-orange-400 text-sm font-bold uppercase tracking-widest animate-pulse">
                      Agent Speaks
                    </p>
                  ) : (
                    <p className="text-green-400 text-sm font-bold uppercase tracking-widest">
                      Agent Listens
                    </p>
                  )
                ) : (
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">
                    Tap to Order
                  </p>
                )}
              </div>
            </div>

            {/* Right Side: Quick Menu */}
            <div className="w-full md:w-64 bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col justify-center relative z-10">
              <h3 className="text-xs font-bold text-orange-400 mb-3 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
                Quick Menu
              </h3>
              <ul className="space-y-2 overflow-y-auto max-h-[160px] pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {MENU_ITEMS.map((item) => (
                  <li key={item.id} className="flex justify-between items-center text-sm group cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-colors">
                    <span className="text-slate-300 group-hover:text-white transition-colors">{item.name}</span>
                    <span className="text-orange-300/80 font-mono text-xs">₹{item.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Transcript Panel */}
          <div className="flex-1 bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-lg">
             <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Conversation</span>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-400">Real-time</span>
             </div>
             <div 
               ref={transcriptContainerRef}
               className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
             >
               {transcript.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 opacity-50">
                    <p className="italic text-sm">Say "Vanakkam" to start.</p>
                 </div>
               ) : (
                 transcript.map((msg, idx) => (
                   <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                     {/* Speaker Label (Diarization) */}
                     <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 px-1 ${msg.role === 'user' ? 'text-orange-400' : 'text-purple-400'}`}>
                        {msg.role === 'user' ? 'Guest' : 'Anbu'}
                     </span>
                     
                     <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed border shadow-sm ${
                       msg.role === 'user' 
                         ? 'bg-orange-600/20 border-orange-500/30 text-white rounded-br-sm' 
                         : 'bg-white/5 border-white/10 text-slate-200 rounded-bl-sm'
                     }`}>
                       {msg.text}
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>

        {/* Right Panel: Cart Only (6 Columns) */}
        <div className="lg:col-span-6 flex flex-col gap-6 h-[calc(100vh-140px)] overflow-hidden">
          
          {/* Cart Panel - Now takes full height */}
          <div className="flex-1 bg-slate-800/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="text-lg font-bold text-white flex items-center gap-2">
                     Your Order
                     <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">{cart.length}</span>
                   </h3>
                </div>
                <div className="text-right">
                   <p className="text-xs text-slate-400 uppercase">Total</p>
                   <p className="text-2xl font-bold text-orange-400">₹{calculateTotal()}</p>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                 {cart.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm italic opacity-50">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                     </svg>
                     Items will appear here when you order
                   </div>
                 ) : (
                   cart.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                           <span className="font-bold text-slate-400 text-xs">x{item.quantity}</span>
                           <span className="font-medium text-slate-200 text-sm">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-sm font-bold text-slate-300">₹{item.price * item.quantity}</span>
                           <button onClick={() => removeFromCart(idx)} className="text-slate-600 hover:text-red-400 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                           </button>
                        </div>
                     </div>
                   ))
                 )}
             </div>

             <div className="mt-4 pt-4 border-t border-white/10">
               <button 
                 onClick={handleConfirmOrder}
                 disabled={cart.length === 0}
                 className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex justify-center items-center gap-2"
               >
                 <span>Confirm Order</span>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                 </svg>
               </button>
             </div>
          </div>
        </div>
      </main>

      {/* Bill/Receipt Modal */}
      {showBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative animate-bounce-in">
             <div className="bg-orange-500 p-4 text-center">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Receipt</h2>
                <p className="text-orange-100 text-xs">Chennai Spice Food Court</p>
             </div>
             
             <div className="p-6 space-y-4">
                <div className="flex justify-between text-xs text-slate-500 border-b border-dashed border-slate-300 pb-2">
                   <span>Date: {new Date().toLocaleDateString()}</span>
                   <span>Time: {new Date().toLocaleTimeString()}</span>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                   {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                         <div>
                            <span className="font-bold mr-2">{item.quantity}x</span>
                            <span>{item.name}</span>
                         </div>
                         <span className="font-mono">₹{item.price * item.quantity}</span>
                      </div>
                   ))}
                </div>

                <div className="border-t-2 border-slate-800 pt-2 flex justify-between items-center text-lg font-bold">
                   <span>TOTAL</span>
                   <span>₹{calculateTotal()}</span>
                </div>
             </div>

             <div className="p-4 bg-gray-50 flex gap-3">
                <button 
                  onClick={closeBill}
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-900 transition-colors"
                >
                  Close & New Order
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;