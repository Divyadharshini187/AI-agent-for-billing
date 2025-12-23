import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { SYSTEM_INSTRUCTION, MENU_ITEMS } from '../constants';
import { ConnectionStatus, OrderItem } from '../types';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface UseLiveSessionProps {
  onOrderUpdate: (items: OrderItem[]) => void;
  onTranscriptUpdate: (text: string, isUser: boolean) => void;
}

export const useLiveSession = ({ onOrderUpdate, onTranscriptUpdate }: UseLiveSessionProps) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isTalking, setIsTalking] = useState(false);
  
  // Refs for audio handling to avoid re-renders
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Define the tool for ordering
  const updateOrderTool: FunctionDeclaration = {
    name: 'updateOrder',
    parameters: {
      type: Type.OBJECT,
      description: 'Update the customer\'s order cart with items.',
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemName: { type: Type.STRING, description: 'Name of the item from the menu' },
              quantity: { type: Type.NUMBER, description: 'Quantity of the item' },
            },
            required: ['itemName', 'quantity']
          },
          description: 'List of items to add or update'
        }
      },
      required: ['items']
    }
  };

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Initialize Audio Contexts with interactive latency hint for faster processing
      const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      const outputCtx = new (window.AudioContext || window.webkitAudioContext)({ 
        sampleRate: 24000,
        latencyHint: 'interactive' 
      });
      
      await inputCtx.resume();
      await outputCtx.resume();

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      
      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      streamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [updateOrderTool] }],
      };

      const sessionPromise = ai.live.connect({
        model: config.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: config.systemInstruction,
          tools: config.tools,
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus('connected');
            
            // Trigger the model to speak first
            sessionPromise.then((session: any) => {
               try {
                 session.sendRealtimeInput({ 
                   content: [{ role: 'user', parts: [{ text: "The user has connected. Greet them in Tamil immediately, ask for their name, and then wait for their response." }] }] 
                 });
               } catch (e) {
                 console.error("Error sending initial trigger:", e);
               }
            });

            // Start processing input audio
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const ctx = inputAudioContextRef.current;
            const source = ctx.createMediaStreamSource(streamRef.current);
            
            // Use 2048 buffer size for lower latency (approx 128ms) compared to 4096 (256ms)
            // ctx.resume() ensures this works reliably on modern browsers
            const processor = ctx.createScriptProcessor(2048, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(ctx.destination);
            
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Interruption
             const interrupted = message.serverContent?.interrupted;
             if (interrupted) {
               console.log('Interrupted');
               sourcesRef.current.forEach(source => {
                 try { source.stop(); } catch(e) {}
               });
               sourcesRef.current.clear();
               
               if (outputAudioContextRef.current) {
                 nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
               }
               setIsTalking(false);
               return; 
             }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                ctx,
                24000,
                1
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setIsTalking(false);
                }
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              setIsTalking(true);
            }

            // Handle Transcripts
            if (message.serverContent?.outputTranscription?.text) {
               onTranscriptUpdate(message.serverContent.outputTranscription.text, false);
            }
            if (message.serverContent?.inputTranscription?.text) {
               onTranscriptUpdate(message.serverContent.inputTranscription.text, true);
            }

            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'updateOrder') {
                   const args = fc.args as any;
                   if (args.items && Array.isArray(args.items)) {
                      const newOrders: OrderItem[] = args.items
                        .filter((item: any) => item && typeof item.itemName === 'string')
                        .map((item: any, index: number) => {
                           const itemNameStr = item.itemName || "";
                           const menuItem = MENU_ITEMS.find(m => m.name.toLowerCase().includes(itemNameStr.toLowerCase()));
                           return {
                              id: Date.now().toString() + index,
                              name: menuItem ? menuItem.name : itemNameStr,
                              price: menuItem ? menuItem.price : 0,
                              quantity: item.quantity || 1
                           };
                        });
                      
                      if (newOrders.length > 0) {
                        onOrderUpdate(newOrders);
                      }

                      sessionPromise.then((session: any) => {
                        session.sendToolResponse({
                          functionResponses: {
                            id: fc.id,
                            name: fc.name,
                            response: { result: 'Order cart updated successfully' }
                          }
                        });
                      });
                   }
                }
              }
            }
          },
          onclose: () => {
            console.log('Session closed');
            setStatus('disconnected');
          },
          onerror: (err) => {
            console.error('Session error:', err);
            setStatus('error');
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error('Failed to connect:', error);
      setStatus('error');
    }
  }, [onOrderUpdate, onTranscriptUpdate]);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch(e) {}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) {}
      sourceRef.current = null;
    }

    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch(e) {}
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch(e) {}
      outputAudioContextRef.current = null;
    }
    
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then((session: any) => {
         try { session.close(); } catch(e) {}
      });
      sessionPromiseRef.current = null;
    }

    setStatus('disconnected');
    setIsTalking(false);
  }, []);

  return { status, connect, disconnect, isTalking };
};